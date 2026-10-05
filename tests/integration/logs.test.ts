import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MAX_ACTIONS_PER_WINDOW } from "../../shared/src/index.ts";
import { ManualClock } from "../fixtures/clock.ts";
import {
  joinOptions,
  receivedState,
  sdkClient,
  startPrototype,
  startTestServer,
  waitFor,
  type TestServer,
} from "../fixtures/server.ts";

const NAME = "SecretNickname";
const MARKER = "PAYLOADMARKER";
const TYPE_MARKER = "typemarkerzzz";

let test: TestServer;
let output = "";
const clock = new ManualClock();

beforeAll(async () => {
  test = await startTestServer({}, { ticks: "manual", clock });
});
afterAll(async () => {
  await test.close();
});

describe("A12 private structured logs", () => {
  it("record reasons and counters but never names, payloads, tokens or addresses", async () => {
    const capture = (chunk: unknown): boolean => {
      output += String(chunk);
      return true;
    };
    const stdout = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(capture);
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(capture);
    try {
      const seats = await startPrototype(test.endpoint, 2, 42, "battle");
      await waitFor(
        () =>
          seats.seated.every(
            (entry) => receivedState(entry.room).phase === "battle",
          ),
        "fixture started",
      );
      // A waiting-room client whose nickname is easy to search for.
      const named = await sdkClient(test.endpoint).joinOrCreate(
        "match",
        joinOptions(NAME),
      );
      const tokens = [
        ...seats.seated.map((entry) => entry.room.reconnectionToken),
        named.reconnectionToken,
      ];
      const sessions = [
        ...seats.seated.map((entry) => entry.room.sessionId),
        named.sessionId,
      ];
      const roomIds = [
        ...seats.seated.map((entry) => entry.room.roomId),
        named.roomId,
      ];

      // Rejected input of every kind.
      seats.seated[0]?.room.send("move", {
        direction: "right",
        note: MARKER,
        scrap: 9999,
      });
      seats.seated[0]?.room.send(TYPE_MARKER, { note: MARKER });
      await expect(
        sdkClient(test.endpoint).joinOrCreate("match", joinOptions("   ")),
      ).rejects.toBeDefined();
      await expect(
        sdkClient(test.endpoint, "https://evil.example").joinOrCreate(
          "match",
          joinOptions(`${NAME}2`),
        ),
      ).rejects.toBeDefined();
      for (let index = 0; index < MAX_ACTIONS_PER_WINDOW + 2; index += 1) {
        seats.seated[1]?.room.send("move", { direction: "up", note: MARKER });
      }
      await waitFor(
        () =>
          test.logs.some((line) => line.includes("frame_dropped")) &&
          test.logs.some((line) => line.includes("input_rejected")) &&
          test.logs.some((line) => line.includes("origin_rejected")) &&
          test.logs.some((line) => line.includes("join_rejected")),
        "every rejection class logged",
      );
      expect(receivedState(seats.seated[0]?.room as never).phase).toBe(
        "battle",
      );

      const logs = test.logs.join("\n");
      for (const secret of [
        NAME,
        `${NAME}2`,
        MARKER,
        TYPE_MARKER,
        ...tokens,
        ...sessions,
        ...roomIds,
      ]) {
        expect(logs).not.toContain(secret);
        expect(output).not.toContain(secret);
      }
      expect(logs).not.toMatch(/127\.0\.0\.1|::1|localhost/);
      expect(output).not.toMatch(/stack|\n\s+at /);

      // Every line is one JSON object with the fixed context and an event type.
      for (const line of test.logs) {
        const event = JSON.parse(line) as Record<string, unknown>;
        expect(event).toMatchObject({
          environment: "local",
          region: "local",
          version: "local-uncommitted",
        });
        expect(typeof event.event).toBe("string");
        expect(Object.keys(event).every((key) => /^[a-z]+$/.test(key))).toBe(
          true,
        );
      }
      const reasons = test.logs
        .map((line) => JSON.parse(line) as { event: string; reason?: string })
        .filter((event) => event.reason !== undefined)
        .map((event) => `${event.event}:${event.reason}`);
      expect(reasons).toEqual(
        expect.arrayContaining([
          "input_rejected:invalid_payload",
          "input_rejected:unknown_type",
          "join_rejected:name_empty",
          "frame_dropped:rate_limit",
        ]),
      );
      await named.leave();
      for (const entry of seats.seated) {
        // The flooded client's leave frame is dropped by design, so bound the wait.
        await Promise.race([
          entry.room.leave().catch(() => undefined),
          new Promise((resolve) => setTimeout(resolve, 300)),
        ]);
      }
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  });
});
