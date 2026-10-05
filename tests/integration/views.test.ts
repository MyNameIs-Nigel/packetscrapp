import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ROOM_MATCH, layoutFor } from "../../shared/src/index.ts";
import {
  joinOptions,
  receivedState,
  recordFrames,
  sdkClient,
  seat,
  startPrototype,
  startTestServer,
  waitFor,
  type PrototypeSeats,
  type TestServer,
} from "../fixtures/server.ts";

let test: TestServer;
let active: PrototypeSeats | undefined;
beforeAll(async () => {
  test = await startTestServer({}, { ticks: "manual" });
});
afterEach(async () => {
  for (const entry of active?.seated ?? []) {
    await Promise.race([
      entry.room.leave().catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 300)),
    ]);
  }
  active = undefined;
  await waitFor(() => test.server.counters.rooms === 0, "room disposal");
});
afterAll(async () => {
  await test.close();
});

// Five players, seed 42: owned slots per seat in join order, unowned slot 4 (independently recomputed oracle).
const OWNED = [1, 0, 5, 3, 2];
const UNOWNED = 4;
const ALL_SLOTS = [0, 1, 2, 3, 4, 5];

/** Every recognizable sentinel id of the prototype world, per sector slot. */
function idsOf(slot: number): string[] {
  const ids = [`deposit-${slot}`];
  if (slot !== UNOWNED) ids.push(`core-${slot}`);
  return ids;
}

async function startBuild(
  record: Map<number, ReturnType<typeof recordFrames>>,
): Promise<PrototypeSeats> {
  active = await startPrototype(
    test.endpoint,
    5,
    42,
    "build",
    (room, index) => {
      record.set(index, recordFrames(room));
    },
  );
  await waitFor(
    () =>
      active?.seated.every((entry) => {
        const state = receivedState(entry.room);
        return state.phase === "build" && state.ships.length > 0;
      }) === true,
    "build fixture on every client",
  );
  return active;
}

describe("V01 build-phase views, as received", () => {
  it("sends each seat only its own sector, in decoded state and in the raw bytes", async () => {
    const frames = new Map<number, ReturnType<typeof recordFrames>>();
    const seats = await startBuild(frames);
    test.server.advanceTicks(4);
    await waitFor(
      () => seats.seated.every((entry) => receivedState(entry.room).tick === 4),
      "tick 4 on every client",
    );

    seats.seated.forEach((entry, index) => {
      const own = OWNED[index] ?? -1;
      const state = receivedState(entry.room);
      expect(state.phase).toBe("build");
      expect(state.playerCount).toBe(5);

      // Decoded state: own ship, own sector entities, full roster without foreign sector data.
      expect(state.ships.map((ship) => ship.seat)).toEqual([index]);
      expect(state.entities.map((entity) => entity.id).sort()).toEqual(
        idsOf(own).sort(),
      );
      expect(state.entities.every((entity) => entity.slot === own)).toBe(true);
      expect(state.players.map((player) => player.seat)).toEqual([
        0, 1, 2, 3, 4,
      ]);
      expect(
        state.players.every((player) => !player.bot && player.coreAlive),
      ).toBe(true);
      for (const player of state.players) {
        expect(player.slot).toBe(player.seat === index ? own : undefined);
      }

      // Raw bytes: every foreign sentinel id is absent from everything this client received.
      const bytes = frames.get(index)?.text() ?? "";
      expect(bytes.length).toBeGreaterThan(0);
      for (const id of idsOf(own)) expect(bytes).toContain(id);
      for (const slot of ALL_SLOTS.filter((candidate) => candidate !== own)) {
        for (const id of idsOf(slot)) expect(bytes).not.toContain(id);
      }
      // The unowned sector is hidden too.
      expect(bytes).not.toContain(`deposit-${UNOWNED}`);
    });
  });

  it("keeps other seats' movement out of a client's patches", async () => {
    const frames = new Map<number, ReturnType<typeof recordFrames>>();
    const seats = await startBuild(frames);
    const watcher = seats.seated[0];
    const before = frames.get(0)?.count() ?? 0;
    seats.seated[3]?.room.send("move", { direction: "down" });
    await waitFor(
      () => test.server.counters.inputsAccepted >= 1,
      "intent stored",
    );
    test.server.advanceTicks(2);
    await waitFor(
      () => seats.seated.every((entry) => receivedState(entry.room).tick === 2),
      "moved",
    );
    const mover = receivedState(seats.seated[3]?.room as never).ships;
    expect(mover.map((ship) => ship.seat)).toEqual([3]);
    expect(mover[0]).toMatchObject({ facing: "down" });
    // The watcher got tick patches but still holds exactly its own ship and sector.
    expect((frames.get(0)?.count() ?? 0) - before).toBeGreaterThan(0);
    expect(
      receivedState(watcher?.room as never).ships.map((ship) => ship.seat),
    ).toEqual([0]);
  });

  it("reveals every sector, ship, core and owner at the battle boundary and nothing earlier", async () => {
    const frames = new Map<number, ReturnType<typeof recordFrames>>();
    const seats = await startBuild(frames);
    expect(test.server.revealBattle(seats.roomId)).toBe(true);
    await waitFor(
      () =>
        seats.seated.every((entry) => {
          const state = receivedState(entry.room);
          return state.phase === "battle" && state.ships.length === 5;
        }),
      "reveal on every client",
    );
    const layout = layoutFor(5);
    seats.seated.forEach((entry, index) => {
      const state = receivedState(entry.room);
      expect(state.ships.map((ship) => ship.seat)).toEqual([0, 1, 2, 3, 4]);
      expect(
        state.entities.filter((entity) => entity.kind === "core"),
      ).toHaveLength(5);
      expect(
        state.entities.filter((entity) => entity.kind === "deposit"),
      ).toHaveLength(layout.slots.length);
      expect(state.players.map((player) => player.slot)).toEqual(OWNED);
      const bytes = frames.get(index)?.text() ?? "";
      for (const slot of ALL_SLOTS) {
        for (const id of idsOf(slot)) expect(bytes).toContain(id);
      }
    });
  });

  it("refuses to add a late client to a running fixture, so a late view cannot leak", async () => {
    const seats = await startBuild(new Map());
    await expect(
      sdkClient(test.endpoint).joinById(
        seats.roomId,
        joinOptions("Late", { seats: 5, seed: 42, view: "build" }),
      ),
    ).rejects.toBeDefined();
    expect(test.server.counters.players).toBe(5);
  });
});

describe("V01 waiting room is roster-only", () => {
  it("carries no ships, entities or sector assignments", async () => {
    const frames = recordFramesFor();
    const first = await seat(
      sdkClient(test.endpoint),
      ROOM_MATCH,
      joinOptions("A"),
    );
    frames.attach(first.room);
    const second = await seat(
      sdkClient(test.endpoint),
      ROOM_MATCH,
      joinOptions("B"),
      first.room.roomId,
    );
    await waitFor(
      () => receivedState(first.room).players.length === 2,
      "roster",
    );
    const state = receivedState(first.room);
    expect(state.phase).toBe("waiting");
    expect(state.prototype).toBe(false);
    expect(state.playerCount).toBe(0);
    expect(state.ships).toEqual([]);
    expect(state.entities).toEqual([]);
    expect(state.players.every((player) => player.slot === undefined)).toBe(
      true,
    );
    const bytes = frames.text();
    expect(bytes).not.toMatch(/core-|deposit-/);
    await first.room.leave();
    await second.room.leave();
    await waitFor(() => test.server.counters.rooms === 0, "disposal");
  });
});

function recordFramesFor(): {
  attach(room: Parameters<typeof recordFrames>[0]): void;
  text(): string;
} {
  let recorder: ReturnType<typeof recordFrames> | undefined;
  return {
    attach: (room) => {
      recorder = recordFrames(room);
    },
    text: () => recorder?.text() ?? "",
  };
}
