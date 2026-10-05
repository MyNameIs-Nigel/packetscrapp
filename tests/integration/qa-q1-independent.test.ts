import { afterAll, beforeAll, expect, it } from "vitest";
import { ManualClock } from "../fixtures/clock.ts";
import {
  LOCAL_ORIGIN,
  receivedState,
  startPrototype,
  startTestServer,
  waitFor,
  type TestServer,
} from "../fixtures/server.ts";

// Independent acceptance probes; included in `npm run test:integration`.
// A failing hard criterion remains failing until Engineering supplies a fix.
let test: TestServer;
const clock = new ManualClock();
beforeAll(async () => {
  clock.advance(137);
  test = await startTestServer({}, { ticks: "manual", clock });
});
afterAll(async () => {
  await test.close();
});

it("H02 rejects a missing Origin on matchmaking preflight", async () => {
  const url = `${test.endpoint}/matchmake/joinOrCreate/match`;
  for (const origin of [LOCAL_ORIGIN, "https://wrong.example", undefined]) {
    const response = await fetch(url, {
      method: "OPTIONS",
      headers: {
        "Access-Control-Request-Method": "POST",
        ...(origin === undefined ? {} : { Origin: origin }),
      },
    });
    expect(response.status, `Origin: ${origin ?? "absent"}`).toBe(
      origin === LOCAL_ORIGIN ? 204 : 403,
    );
    expect(response.headers.get("access-control-allow-origin")).toBe(
      origin === LOCAL_ORIGIN ? LOCAL_ORIGIN : null,
    );
  }
});

it("V01 initializes each layout with only own build entities, then reveals", async () => {
  // Published independent seed-42 assignment oracle, not helper output.
  const slotsByCount = [
    [0, 1],
    [0, 3, 1],
    [0, 3, 1, 2],
    [1, 0, 5, 3, 2],
  ];
  for (const slots of slotsByCount) {
    const { seated, roomId } = await startPrototype(
      test.endpoint,
      slots.length,
      42,
      "build",
    );
    try {
      await waitFor(() =>
        seated.every(({ room }) => receivedState(room).phase === "build"),
      );
      seated.forEach(({ room }, index) => {
        const state = receivedState(room);
        expect(state.ships.map((ship) => ship.seat)).toEqual([index]);
        expect(state.entities.map((entity) => entity.id)).toEqual([
          `core-${slots[index]}`,
          `deposit-${slots[index]}`,
        ]);
        expect(state.players.map((player) => player.slot)).toEqual(
          slots.map((slot, seat) => (seat === index ? slot : undefined)),
        );
      });
      expect(test.server.revealBattle(roomId)).toBe(true);
      await waitFor(() =>
        seated.every(({ room }) => receivedState(room).phase === "battle"),
      );
      for (const { room } of seated) {
        expect(receivedState(room).ships).toHaveLength(slots.length);
        expect(receivedState(room).entities).toHaveLength(
          slots.length * 2 + (slots.length % 2),
        );
      }
    } finally {
      await Promise.all(seated.map(({ room }) => room.leave()));
      await waitFor(() => test.server.counters.rooms === 0);
    }
  }
});

it("A02 resets at a nonzero connection anchor, not global whole seconds", async () => {
  const { seated } = await startPrototype(test.endpoint, 2, 42, "battle");
  const room = seated[0]?.room;
  if (!room) throw new Error("Missing first seat");
  const before = { ...test.server.counters };
  try {
    for (let i = 0; i < 30; i += 1) room.send("move", { direction: "down" });
    await waitFor(
      () => test.server.counters.inputsAccepted === before.inputsAccepted + 30,
    );
    clock.advance(863); // Global time 1000, connection age only 863.
    room.send("move", { direction: "up" });
    await waitFor(
      () => test.server.counters.framesDropped === before.framesDropped + 1,
    );
    clock.advance(137); // Connection age exactly 1000.
    room.send("move", { direction: "up" });
    await waitFor(
      () => test.server.counters.inputsAccepted === before.inputsAccepted + 31,
    );
    test.server.advanceTicks(2);
    await waitFor(() => receivedState(room).tick === 2);
    expect(
      receivedState(room).ships.find((ship) => ship.seat === 0),
    ).toMatchObject({ x: 13, y: 10 });
  } finally {
    for (const { room: client } of seated) {
      (
        client.connection.transport as unknown as { ws: { close(): void } }
      ).ws.close();
    }
    await waitFor(() => test.server.counters.rooms === 0);
  }
});
