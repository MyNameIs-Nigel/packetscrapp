import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { layoutFor, type PlayerCount } from "../../shared/src/index.ts";
import {
  joinOptions,
  receivedState,
  sdkClient,
  startPrototype,
  startTestServer,
  waitFor,
  type PrototypeSeats,
  type TestServer,
} from "../fixtures/server.ts";

let test: TestServer;
let active: Run | undefined;
beforeAll(async () => {
  test = await startTestServer({}, { ticks: "manual" });
});
afterEach(async () => {
  for (const entry of active?.seated ?? []) await leaveQuietly(entry.room);
  active = undefined;
  await waitFor(() => test.server.counters.rooms === 0, "room disposal");
});
afterAll(async () => {
  await test.close();
});

// Independently recomputed (Python uint32) published vectors: player count, seed, owned slot per seat.
const PINNED: [PlayerCount, number, number | null, number[]][] = [
  [2, 0, null, [1, 0]],
  [2, 1, null, [0, 1]],
  [2, 42, null, [0, 1]],
  [2, 4294967295, null, [0, 1]],
  [3, 0, 1, [2, 3, 0]],
  [3, 1, 2, [3, 1, 0]],
  [3, 42, 2, [0, 3, 1]],
  [3, 4294967295, 3, [2, 1, 0]],
  [4, 0, null, [3, 2, 0, 1]],
  [4, 1, null, [3, 1, 0, 2]],
  [4, 42, null, [0, 3, 1, 2]],
  [4, 4294967295, null, [2, 1, 0, 3]],
  [5, 0, 1, [2, 3, 4, 5, 0]],
  [5, 1, 4, [5, 1, 3, 2, 0]],
  [5, 42, 4, [1, 0, 5, 3, 2]],
  [5, 4294967295, 4, [5, 1, 3, 2, 0]],
];

/** Leave a room that may already be closed; the SDK promise never settles for a closed room. */
async function leaveQuietly(room: { leave(): Promise<number> }): Promise<void> {
  await Promise.race([
    room.leave().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 300)),
  ]);
}

interface Run extends PrototypeSeats {
  /** Simulation ticks run so far; every connected client must have received this tick. */
  tick: number;
  gone: Set<number>;
}

async function start(
  count: number,
  seed: number,
  view: "build" | "battle",
): Promise<Run> {
  const seats = await startPrototype(test.endpoint, count, seed, view);
  const run: Run = { ...seats, tick: 0, gone: new Set() };
  active = run;
  await waitFor(
    () => run.seated.every((entry) => receivedState(entry.room).phase === view),
    `${view} fixture on every client`,
  );
  return run;
}

/** Send a payload and wait until the server has counted it as accepted or rejected. */
async function steer(
  run: Run,
  index: number,
  payload: unknown,
  accepted = true,
): Promise<void> {
  const counter = accepted ? "inputsAccepted" : "inputsRejected";
  const before = test.server.counters[counter];
  run.seated[index]?.room.send("move", payload);
  await waitFor(
    () => test.server.counters[counter] > before,
    `${counter} to increase`,
  );
}

/** Run `count` ticks and wait until every connected client has received the resulting tick. */
async function advance(run: Run, count: number): Promise<void> {
  test.server.advanceTicks(count);
  run.tick += count;
  await waitFor(
    () =>
      run.seated.every(
        (entry, index) =>
          run.gone.has(index) || receivedState(entry.room).tick === run.tick,
      ),
    `tick ${run.tick} on every client`,
  );
}

function shipOf(run: Run, viewer: number, seat: number) {
  const entry = run.seated[viewer];
  return entry
    ? receivedState(entry.room).ships.find((ship) => ship.seat === seat)
    : undefined;
}

/** Every connected client sees the same ship for `seat`. */
function agreedShip(run: Run, seat: number) {
  const views = run.seated
    .map((_, viewer) => viewer)
    .filter((viewer) => !run.gone.has(viewer))
    .map((viewer) => shipOf(run, viewer, seat));
  for (const view of views) expect(view).toEqual(views[0]);
  return views[0];
}

describe("M03 runtime seat assignment", () => {
  it.each(PINNED)(
    "places %i players with seed %i exactly as the published oracle",
    async (count, seed, unowned, owned) => {
      const run = await start(count, seed, "battle");
      const layout = layoutFor(count);
      const view = receivedState(run.seated[0]?.room as never);
      expect(view.playerCount).toBe(count);
      // Join order is seat order here, so seat i owns owned[i].
      expect(view.players.map((player) => player.slot)).toEqual(owned);
      expect(view.ships).toHaveLength(count);
      view.ships.forEach((ship, rank) => {
        const slot = layout.slots[owned[rank] ?? -1];
        expect(ship).toMatchObject({
          seat: rank,
          x: slot?.spawn.x,
          y: slot?.spawn.y,
          facing: slot?.spawnFacing,
          alive: true,
        });
      });
      // The unowned slot is the one with a sentinel but no core and no owner.
      const owners = new Set(owned);
      const withoutOwner = layout.slots
        .map((s) => s.index)
        .filter((slot) => !owners.has(slot));
      expect(withoutOwner).toEqual(unowned === null ? [] : [unowned]);
      expect(
        view.entities.filter((entity) => entity.kind === "core"),
      ).toHaveLength(count);
      expect(
        view.entities.filter((entity) => entity.kind === "deposit"),
      ).toHaveLength(layout.slots.length);
    },
  );
});

describe("M01 server-owned movement", () => {
  it("moves one tile on tick 2 and not on odd ticks, identically on both clients", async () => {
    const run = await start(2, 42, "battle");
    expect(agreedShip(run, 0)).toMatchObject({ x: 13, y: 11, facing: "right" });
    await steer(run, 0, { direction: "right" });
    const positions: number[] = [];
    for (let tick = 1; tick <= 4; tick += 1) {
      await advance(run, 1);
      positions.push(agreedShip(run, 0)?.x ?? -1);
    }
    expect(positions).toEqual([13, 14, 14, 15]);
    expect(agreedShip(run, 1)).toMatchObject({ x: 34, y: 11, facing: "left" });
    // The sentinel deposit at (16, 11) blocks the next step; the held intent and facing persist.
    await advance(run, 4);
    expect(agreedShip(run, 0)).toMatchObject({ x: 15, y: 11, facing: "right" });
    await steer(run, 0, { direction: "none" });
    await advance(run, 4);
    expect(agreedShip(run, 0)).toMatchObject({ x: 15, y: 11, facing: "right" });
  });

  it("uses the latest validated intent and changes facing on a successful step", async () => {
    const run = await start(2, 42, "battle");
    await steer(run, 0, { direction: "up" });
    await steer(run, 0, { direction: "down" });
    await advance(run, 2);
    expect(agreedShip(run, 0)).toMatchObject({ x: 13, y: 12, facing: "down" });
    await steer(run, 0, { direction: "up" });
    await advance(run, 2);
    expect(agreedShip(run, 0)).toMatchObject({ x: 13, y: 11, facing: "up" });
  });

  it("moves both seats independently and lets them cross the sector border in battle", async () => {
    const run = await start(2, 42, "battle");
    await steer(run, 0, { direction: "down" });
    await steer(run, 1, { direction: "up" });
    await advance(run, 2);
    expect(agreedShip(run, 0)).toMatchObject({ x: 13, y: 12, facing: "down" });
    expect(agreedShip(run, 1)).toMatchObject({ x: 34, y: 10, facing: "up" });
    await steer(run, 0, { direction: "right" });
    await advance(run, 2 * 12);
    // Twelve steps from x=13 reach x=25, past the old Belt and into the other sector.
    expect(agreedShip(run, 0)).toMatchObject({ x: 25, y: 12, alive: true });
  });
});

describe("M02 collisions and the build-phase Belt", () => {
  it("fails a shared-destination move and then a head-on swap for both ships", async () => {
    const run = await start(2, 42, "battle");
    await steer(run, 0, { direction: "down" });
    await steer(run, 1, { direction: "down" });
    await advance(run, 2);
    // Both on row 12: seat 0 at x=13, seat 1 at x=34. One extra step makes the gap even.
    await steer(run, 0, { direction: "none" });
    await steer(run, 1, { direction: "left" });
    await advance(run, 2);
    expect(agreedShip(run, 1)).toMatchObject({ x: 33, y: 12 });
    await steer(run, 0, { direction: "right" });
    await advance(run, 2 * 9);
    // Nine joint steps leave seats at x=22 and x=24 with one empty tile (23) between them.
    expect(agreedShip(run, 0)).toMatchObject({ x: 22, y: 12 });
    expect(agreedShip(run, 1)).toMatchObject({ x: 24, y: 12 });
    // Both now target (23, 12): neither moves, and both keep intent and facing.
    await advance(run, 2 * 3);
    expect(agreedShip(run, 0)).toMatchObject({ x: 22, y: 12, facing: "right" });
    expect(agreedShip(run, 1)).toMatchObject({ x: 24, y: 12, facing: "left" });
    // Make them adjacent, then try a swap: seat 1 stops, seat 0 closes the gap.
    await steer(run, 1, { direction: "none" });
    await advance(run, 2);
    expect(agreedShip(run, 0)).toMatchObject({ x: 23, y: 12 });
    await steer(run, 1, { direction: "left" });
    await advance(run, 2 * 3);
    expect(agreedShip(run, 0)).toMatchObject({ x: 23, y: 12 });
    expect(agreedShip(run, 1)).toMatchObject({ x: 24, y: 12 });
  });

  it("blocks a step into the ship's own core without turning the ship", async () => {
    const run = await start(2, 42, "battle");
    await steer(run, 0, { direction: "left" });
    await advance(run, 2);
    await advance(run, 2);
    // Seat 0 spawns at (13, 11), next to its core at (12, 11): the core blocks entry.
    expect(agreedShip(run, 0)).toMatchObject({ x: 13, y: 11, facing: "right" });
  });

  it("makes the Belt step lethal during build and never reaches the far side", async () => {
    const run = await start(2, 42, "build");
    await steer(run, 0, { direction: "down" });
    await advance(run, 2);
    await steer(run, 0, { direction: "right" });
    await advance(run, 2 * 9);
    expect(shipOf(run, 0, 0)).toMatchObject({
      x: 22,
      y: 12,
      alive: true,
      facing: "right",
    });
    await advance(run, 2);
    expect(shipOf(run, 0, 0)).toMatchObject({
      x: 23,
      y: 12,
      facing: "right",
      alive: false,
    });
    // Dead ships take no further steps and cannot be steered; nothing reaches (24, 12).
    await advance(run, 10);
    expect(shipOf(run, 0, 0)).toMatchObject({ x: 23, alive: false });
    const rejected = test.server.counters.inputsRejected;
    run.seated[0]?.room.send("move", { direction: "right" });
    await waitFor(
      () => test.server.counters.inputsRejected > rejected,
      "dead ship refused",
    );
  });

  it("drops the Belt at the reveal so the same step is harmless", async () => {
    const run = await start(2, 42, "build");
    expect(test.server.revealBattle(run.roomId)).toBe(true);
    expect(test.server.revealBattle(run.roomId)).toBe(false);
    await waitFor(
      () => receivedState(run.seated[0]?.room as never).phase === "battle",
      "reveal",
    );
    await steer(run, 0, { direction: "down" });
    await advance(run, 2);
    await steer(run, 0, { direction: "right" });
    await advance(run, 2 * 12);
    expect(agreedShip(run, 0)).toMatchObject({ x: 25, y: 12, alive: true });
  });
});

describe("A01 forged and malformed input", () => {
  const forged: [string, unknown][] = [
    ["extra x", { direction: "right", x: 99 }],
    ["extra health", { direction: "right", health: 1000 }],
    ["extra scrap", { direction: "right", scrap: 9999 }],
    ["extra seatId", { direction: "right", seatId: 1 }],
    ["future timestamp", { direction: "right", at: Date.now() + 1e9 }],
    ["unknown direction", { direction: "sideways" }],
    ["upper case", { direction: "RIGHT" }],
    ["array direction", { direction: ["right"] }],
    ["numeric direction", { direction: 1 }],
    ["null", null],
    ["bare string", "right"],
    ["array", ["right"]],
    ["empty object", {}],
    [
      "prototype key",
      JSON.parse('{"__proto__":{"direction":"right"},"direction":"right"}'),
    ],
    ["position object", { position: { x: 0, y: 0 } }],
    ["nested", { direction: { direction: "right" } }],
  ];

  it.each(forged)(
    "rejects %s and leaves state and other clients alone",
    async (_label, payload) => {
      const run = await start(2, 42, "battle");
      await steer(run, 0, payload, false);
      await advance(run, 4);
      expect(agreedShip(run, 0)).toMatchObject({
        x: 13,
        y: 11,
        facing: "right",
      });
      // The other client still moves normally.
      await steer(run, 1, { direction: "up" });
      await advance(run, 2);
      expect(agreedShip(run, 1)).toMatchObject({ y: 10 });
    },
  );

  it("keeps the previous intent when a later message is invalid", async () => {
    const run = await start(2, 42, "battle");
    await steer(run, 0, { direction: "down" });
    await steer(run, 0, { direction: "down", x: 1 }, false);
    await advance(run, 4);
    expect(agreedShip(run, 0)).toMatchObject({ y: 13 });
  });

  it("drops unknown message types without a state change", async () => {
    const run = await start(2, 42, "battle");
    const before = test.server.counters.inputsRejected;
    for (const type of [
      "teleport",
      "fire",
      "build",
      "start",
      "setPosition",
      7,
    ]) {
      run.seated[0]?.room.send(type as string, { direction: "right" });
    }
    await waitFor(
      () => test.server.counters.inputsRejected >= before + 6,
      "all dropped",
    );
    await advance(run, 4);
    expect(agreedShip(run, 0)).toMatchObject({ x: 13, y: 11 });
  });

  it("stops a departed seat's ship and clears its held intent", async () => {
    const run = await start(2, 42, "battle");
    await steer(run, 0, { direction: "down" });
    run.gone.add(0);
    await leaveQuietly(run.seated[0]?.room as never);
    await waitFor(() => test.server.counters.players === 1, "departure");
    await advance(run, 6);
    expect(shipOf(run, 1, 0)).toMatchObject({ x: 13, y: 11 });
  });
});

describe("prototype admission", () => {
  it("rejects invalid fixture options without creating a room", async () => {
    for (const options of [
      joinOptions("A", { seats: 1, seed: 1, view: "build" }),
      joinOptions("A", { seats: 2, seed: -1, view: "build" }),
      joinOptions("A", { seats: 2, seed: 1, view: "debug" }),
      joinOptions("A"),
    ]) {
      await expect(
        sdkClient(test.endpoint).joinOrCreate("prototype", options),
      ).rejects.toBeDefined();
    }
    expect(test.server.counters.rooms).toBe(0);
  });

  it("locks the fixture so nobody joins a running prototype", async () => {
    const run = await start(2, 42, "battle");
    await expect(
      sdkClient(test.endpoint).joinById(
        run.roomId,
        joinOptions("Late", { seats: 2, seed: 42, view: "battle" }),
      ),
    ).rejects.toBeDefined();
    expect(test.server.counters.players).toBe(2);
  });
});
