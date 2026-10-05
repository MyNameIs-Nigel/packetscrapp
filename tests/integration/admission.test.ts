import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  JOIN_ERROR_CODES,
  JOIN_ERROR_MESSAGES,
  PROTOCOL_VERSION,
  ROOM_MATCH,
  type JoinErrorReason,
} from "../../shared/src/index.ts";
import {
  joinOptions,
  sdkClient,
  seat,
  startTestServer,
  waitFor,
  type Seated,
  type TestServer,
} from "../fixtures/server.ts";

let test: TestServer;
beforeAll(async () => {
  test = await startTestServer();
});
afterAll(async () => {
  await test.close();
});

interface RosterEntry {
  seat: number;
  name: string;
  bot: boolean;
  coreAlive: boolean;
}

function roster(seated: Seated): RosterEntry[] {
  const entries: RosterEntry[] = [];
  const players = (seated.room.state as { players?: Map<string, RosterEntry> })
    .players;
  players?.forEach((player) =>
    entries.push({
      seat: player.seat,
      name: player.name,
      bot: player.bot,
      coreAlive: player.coreAlive,
    }),
  );
  return entries.sort((a, b) => a.seat - b.seat);
}

async function settle(): Promise<void> {
  await waitFor(
    () =>
      test.server.counters.rooms === 0 && test.server.counters.players === 0,
    "all rooms disposed",
  );
}

async function expectJoinError(
  promise: Promise<unknown>,
  reason: JoinErrorReason,
): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    code: JOIN_ERROR_CODES[reason],
    message: JOIN_ERROR_MESSAGES[reason],
  });
}

describe("J01 seats and roster", () => {
  it("admits seats 0 to 4 in one waiting room and rejects the sixth", async () => {
    const names = ["Ada", "Ben", "Cy", "Dee", "Eli"];
    const first = await seat(
      sdkClient(test.endpoint),
      ROOM_MATCH,
      joinOptions(names[0] ?? ""),
    );
    const roomId = first.room.roomId;
    const seated: Seated[] = [first];
    for (const name of names.slice(1)) {
      seated.push(
        await seat(
          sdkClient(test.endpoint),
          ROOM_MATCH,
          joinOptions(name),
          roomId,
        ),
      );
    }
    expect(seated.map((entry) => entry.seat)).toEqual([0, 1, 2, 3, 4]);
    expect(new Set(seated.map((entry) => entry.room.sessionId)).size).toBe(5);
    for (const entry of seated) {
      await waitFor(() => roster(entry).length === 5, "five-player roster");
      expect(roster(entry).map((player) => player.name)).toEqual(names);
      expect(
        roster(entry).every((player) => !player.bot && player.coreAlive),
      ).toBe(true);
    }
    expect(test.server.counters.players).toBe(5);

    // A full room locks, so the sixth seat is refused and nothing is allocated or replaced.
    await expect(
      sdkClient(test.endpoint).joinById(roomId, joinOptions("Fay")),
    ).rejects.toBeDefined();
    expect(test.server.counters.players).toBe(5);
    expect(test.server.counters.rooms).toBe(1);
    expect(roster(first).map((player) => player.name)).toEqual(names);
    for (const entry of seated) await entry.room.leave();
    await settle();
  });

  it.each([2, 3, 4])(
    "admits %i independently connected seats",
    async (count) => {
      const first = await seat(
        sdkClient(test.endpoint),
        ROOM_MATCH,
        joinOptions("P0"),
      );
      const seated = [first];
      for (let index = 1; index < count; index += 1) {
        seated.push(
          await seat(
            sdkClient(test.endpoint),
            ROOM_MATCH,
            joinOptions(`P${index}`),
            first.room.roomId,
          ),
        );
      }
      for (const entry of seated) {
        await waitFor(() => roster(entry).length === count, "roster size");
        expect(roster(entry).map((player) => player.seat)).toEqual(
          Array.from({ length: count }, (_, index) => index),
        );
      }
      for (const entry of seated) await entry.room.leave();
      await settle();
    },
  );

  it("keeps identity server-issued even when the client supplies one", async () => {
    const forged = await seat(
      sdkClient(test.endpoint),
      ROOM_MATCH,
      joinOptions("Mallory", {
        seat: 3,
        seatId: 3,
        sessionId: "evil",
        id: "x",
        slot: 5,
      }),
    );
    expect(forged.seat).toBe(0);
    expect(forged.room.sessionId).not.toBe("evil");
    await waitFor(() => roster(forged).length === 1, "roster");
    expect(roster(forged)[0]).toMatchObject({ seat: 0, name: "Mallory" });
    await forged.room.leave();
    await settle();
  });

  it("reuses the lowest free seat after a departure", async () => {
    const first = await seat(
      sdkClient(test.endpoint),
      ROOM_MATCH,
      joinOptions("One"),
    );
    const second = await seat(
      sdkClient(test.endpoint),
      ROOM_MATCH,
      joinOptions("Two"),
      first.room.roomId,
    );
    await first.room.leave();
    await waitFor(() => roster(second).length === 1, "departure");
    const third = await seat(
      sdkClient(test.endpoint),
      ROOM_MATCH,
      joinOptions("Three"),
      second.room.roomId,
    );
    expect(third.seat).toBe(0);
    await waitFor(() => roster(second).length === 2, "arrival");
    expect(
      roster(second).map((player) => `${player.seat}:${player.name}`),
    ).toEqual(["0:Three", "1:Two"]);
    await second.room.leave();
    await third.room.leave();
    await settle();
  });
});

describe("J02 names and negotiation", () => {
  it("stores sanitized names as literal text", async () => {
    const markup = await seat(
      sdkClient(test.endpoint),
      ROOM_MATCH,
      joinOptions("<b>x</b>"),
    );
    const accent = await seat(
      sdkClient(test.endpoint),
      ROOM_MATCH,
      joinOptions("  Café\u0007  "),
      markup.room.roomId,
    );
    await waitFor(() => roster(markup).length === 2, "roster");
    expect(roster(markup).map((player) => player.name)).toEqual([
      "<b>x</b>",
      "Café",
    ]);
    await markup.room.leave();
    await accent.room.leave();
    await settle();
  });

  it.each<[string, string, JoinErrorReason]>([
    ["empty", "", "name_empty"],
    ["whitespace-only", "   ", "name_empty"],
    ["control-only", "\u0000\u001f\u007f\u009f", "name_empty"],
    ["17 code points", "a".repeat(17), "name_too_long"],
  ])("rejects a %s name before any allocation", async (_label, name, code) => {
    await expectJoinError(
      sdkClient(test.endpoint).joinOrCreate(ROOM_MATCH, joinOptions(name)),
      code,
    );
    expect(test.server.counters.rooms).toBe(0);
    expect(test.server.counters.players).toBe(0);
  });

  it("rejects an old protocol and a wrong environment before any allocation", async () => {
    await expectJoinError(
      sdkClient(test.endpoint).joinOrCreate(
        ROOM_MATCH,
        joinOptions("Alex", { protocol: PROTOCOL_VERSION - 1 }),
      ),
      "protocol",
    );
    await expectJoinError(
      sdkClient(test.endpoint).joinOrCreate(
        ROOM_MATCH,
        joinOptions("Alex", { environment: "production" }),
      ),
      "environment",
    );
    await expectJoinError(
      sdkClient(test.endpoint).joinOrCreate(ROOM_MATCH, {}),
      "malformed",
    );
    expect(test.server.counters.rooms).toBe(0);
    expect(test.server.counters.joinsRejected).toBeGreaterThanOrEqual(3);
  });

  it("refuses an unknown room type", async () => {
    await expect(
      sdkClient(test.endpoint).joinOrCreate("nonexistent", joinOptions("Alex")),
    ).rejects.toBeDefined();
    expect(test.server.counters.rooms).toBe(0);
  });
});

describe("L01 cleanup", () => {
  it("disposes the room after the last client leaves and recovers counters", async () => {
    const first = await seat(
      sdkClient(test.endpoint),
      ROOM_MATCH,
      joinOptions("One"),
    );
    const second = await seat(
      sdkClient(test.endpoint),
      ROOM_MATCH,
      joinOptions("Two"),
      first.room.roomId,
    );
    await waitFor(() => test.server.counters.players === 2, "two players");
    await first.room.leave();
    await waitFor(() => roster(second).length === 1, "roster update");
    expect(test.server.counters.rooms).toBe(1);
    await second.room.leave();
    await settle();
  });

  it("does not leak identity or input into a new room", async () => {
    const first = await seat(
      sdkClient(test.endpoint),
      ROOM_MATCH,
      joinOptions("Old"),
    );
    first.room.send("move", { direction: "up" });
    await first.room.leave();
    await settle();
    const next = await seat(
      sdkClient(test.endpoint),
      ROOM_MATCH,
      joinOptions("New"),
    );
    expect(next.room.roomId).not.toBe(first.room.roomId);
    await waitFor(() => roster(next).length === 1, "roster");
    expect(roster(next)[0]).toMatchObject({ seat: 0, name: "New" });
    await next.room.leave();
    await settle();
  });

  it("disposes repeatedly joined and abandoned rooms", async () => {
    for (let round = 0; round < 5; round += 1) {
      const entry = await seat(
        sdkClient(test.endpoint),
        ROOM_MATCH,
        joinOptions(`Round${round}`),
      );
      await entry.room.leave();
    }
    await settle();
  });
});
