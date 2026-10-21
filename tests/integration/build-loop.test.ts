import { afterAll, beforeAll, expect, it } from "vitest";
import {
  ROOM_BUILD,
  createBuildWorld,
  stepFor,
} from "../../shared/src/index.ts";
import {
  joinOptions,
  receivedState,
  recordFrames,
  sdkClient,
  seat,
  startTestServer,
  waitFor,
  type Seated,
  type TestServer,
} from "../fixtures/server.ts";

let test: TestServer;
beforeAll(async () => {
  test = await startTestServer({}, { ticks: "manual" });
});
afterAll(async () => {
  await test.close();
});
async function start(count: number) {
  const seated: Seated[] = [],
    frames: ReturnType<typeof recordFrames>[] = [];
  let id: string | undefined;
  for (let n = 0; n < count; n++) {
    const e = await seat(
      sdkClient(test.endpoint),
      ROOM_BUILD,
      joinOptions(`Builder${n}`, { seats: count, seed: 42, view: "build" }),
      id,
      (r) => frames.push(recordFrames(r)),
    );
    id = e.room.roomId;
    seated.push(e);
  }
  await waitFor(() =>
    seated.every((e) => receivedState(e.room).phase === "build"),
  );
  return { seated, frames, id };
}
async function cleanup(seated: Seated[]) {
  await Promise.all(seated.map((e) => e.room.leave()));
  await waitFor(() => test.server.counters.rooms === 0);
}
interface PrivatePlayer {
  seat: number;
  scrap: number;
  hull: number;
  maxHull: number;
  blasterLevel: number;
  role: string;
}
function players(e: Seated): PrivatePlayer[] {
  const values: PrivatePlayer[] = [];
  (
    e.room.state as {
      players: { forEach(fn: (v: PrivatePlayer) => void): void };
    }
  ).players.forEach((p) => values.push(p));
  return values;
}

it.each([2, 3, 4, 5])(
  "starts %i clients with generated private deposits and reveals on tick 1800",
  async (count) => {
    const { seated, frames } = await start(count);
    try {
      const map = createBuildWorld(
        Array.from({ length: count }, (_, i) => i),
        42,
      ).map;
      for (let i = 0; i < count; i++) {
        const state = receivedState(seated[i]!.room),
          own = map.seats[i]!.slot;
        expect(state.entities).toHaveLength(11);
        expect(state.entities.every((e) => e.slot === own)).toBe(true);
        expect(frames[i]!.initialStateCount()).toBe(1);
        const bytes = frames[i]!.text();
        for (const d of map.deposits) {
          if (d.slot === own) expect(bytes).toContain(d.id);
          else expect(bytes).not.toContain(d.id);
        }
        for (const p of players(seated[i]!))
          expect(p.scrap).toBe(p.seat === i ? 0 : undefined);
      }
      test.server.advanceTicks(1799);
      await waitFor(() =>
        seated.every((e) => receivedState(e.room).tick === 1799),
      );
      expect(receivedState(seated[0]!.room).entities).toHaveLength(11);
      test.server.advanceTicks(1);
      await waitFor(() =>
        seated.every((e) => receivedState(e.room).phase === "battle"),
      );
      for (const e of seated)
        expect(receivedState(e.room).entities).toHaveLength(
          map.deposits.length + count,
        );
      test.server.advanceTicks(10);
      expect(receivedState(seated[0]!.room).tick).toBe(1800);
    } finally {
      await cleanup(seated);
    }
  },
);

it("harvests through actual SDK inputs, spends once and sends private feedback", async () => {
  const { seated } = await start(2),
    one = seated[0]!;
  try {
    const world = createBuildWorld([0, 1], 42),
      p = world.seats[0]!;
    // Find a legal firing pose from the received own-sector geometry using BFS.
    const own = world.map.seats[0]!,
      blocked = new Set(world.entities.map((e) => `${e.x},${e.y}`));
    const queue = [{ x: p.x, y: p.y, path: [] as string[] }],
      seen = new Set<string>();
    let route: { path: string[]; direction: string } | undefined;
    for (let idx = 0; idx < queue.length && !route; idx++) {
      const cell = queue[idx]!;
      for (const direction of ["up", "right", "down", "left"] as const) {
        const d = stepFor(direction),
          next = { x: cell.x + d.x, y: cell.y + d.y };
        for (let r = 1; r <= 8; r++) {
          const target = world.entities.find(
            (e) => e.x === cell.x + d.x * r && e.y === cell.y + d.y * r,
          );
          if (target) {
            if (
              target.kind === "deposit" &&
              target.scrap === 10 &&
              cell.path.at(-1) === direction
            )
              route = { path: cell.path, direction };
            break;
          }
        }
        const key = `${next.x},${next.y}`;
        if (
          next.x < 1 ||
          next.x > 22 ||
          next.y < 1 ||
          next.y > 22 ||
          blocked.has(key) ||
          seen.has(key)
        )
          continue;
        seen.add(key);
        queue.push({ ...next, path: [...cell.path, direction] });
      }
    }
    if (!route) throw Error("No firing pose");
    for (const direction of route.path) {
      const before = test.server.counters.inputsAccepted;
      one.room.send("move", { direction });
      await waitFor(() => test.server.counters.inputsAccepted > before);
      test.server.advanceTicks(2);
    }
    const before = test.server.counters.inputsAccepted;
    one.room.send("move", { direction: "none" });
    await waitFor(() => test.server.counters.inputsAccepted > before);
    for (let n = 0; n < 3; n++) {
      const before = test.server.counters.inputsAccepted;
      one.room.send("fire");
      await waitFor(() => test.server.counters.inputsAccepted > before);
      test.server.advanceTicks(5);
    }
    await waitFor(() => players(one).find((p) => p.seat === 0)?.scrap === 10);
    expect(
      players(seated[1]!).find((p) => p.seat === 0)?.scrap,
    ).toBeUndefined();
    // Invalid payload cannot claim price, position or another seat's balance.
    const rejected = test.server.counters.inputsRejected;
    one.room.send("build", { kind: "wall", scrap: 999, seat: 1 });
    await waitFor(() => test.server.counters.inputsRejected > rejected);
    const feedback: string[] = [];
    one.room.onMessage("feedback", (m: { text: string }) =>
      feedback.push(m.text),
    );
    const accepted = test.server.counters.inputsAccepted;
    one.room.send("upgrade", { kind: "hull" });
    await waitFor(() => test.server.counters.inputsAccepted > accepted);
    test.server.advanceTicks(1);
    await waitFor(() => feedback.some((t) => t.includes("Need 40 scrap")));
    expect(players(one).find((p) => p.seat === 0)?.scrap).toBe(10);
    expect(own.scrap).toBe(0);
  } finally {
    await cleanup(seated);
  }
});

it("rejects actions before start and preserves build privacy on an early result", async () => {
  const one = await seat(
    sdkClient(test.endpoint),
    ROOM_BUILD,
    joinOptions("One", { seats: 2, seed: 42, view: "build" }),
  );
  const before = test.server.counters.inputsRejected;
  one.room.send("fire");
  await waitFor(() => test.server.counters.inputsRejected > before);
  const two = await seat(
    sdkClient(test.endpoint),
    ROOM_BUILD,
    joinOptions("Two", { seats: 2, seed: 42, view: "build" }),
    one.room.roomId,
  );
  await waitFor(() => receivedState(one.room).phase === "build");
  await two.room.leave();
  await waitFor(() => test.server.counters.players === 1);
  test.server.advanceTicks(1);
  await waitFor(() => receivedState(one.room).phase === "ended");
  expect(receivedState(one.room).entities).toHaveLength(11);
  expect((one.room.state as { revealed: boolean }).revealed).toBe(false);
  await one.room.leave();
  await waitFor(() => test.server.counters.rooms === 0);
});
