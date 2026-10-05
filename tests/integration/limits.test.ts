import { pack } from "msgpackr";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  FLOOD_FRAMES_PER_WINDOW,
  FRAME_WINDOW_MS,
  MAX_ACTIONS_PER_WINDOW,
  MAX_FRAME_BYTES,
} from "../../shared/src/index.ts";
import type { Counters } from "../../server/src/runtime.ts";
import { ManualClock } from "../fixtures/clock.ts";
import {
  receivedState,
  startPrototype,
  startTestServer,
  waitFor,
  type PrototypeSeats,
  type TestServer,
} from "../fixtures/server.ts";

// Colyseus protocol codes (documented in @colyseus/shared-types).
const ROOM_DATA = 13;
const ROOM_DATA_BYTES = 17;
const ROOM_INPUT_RELIABLE = 19;

let test: TestServer;
const clock = new ManualClock();
let seats: PrototypeSeats;
let closed: Map<number, number>;
let baseline: Counters;

beforeAll(async () => {
  // One server per file: Colyseus's matchmaker is process-wide, so restarting it mid-file leaks shutdown state.
  test = await startTestServer({}, { ticks: "manual", clock });
});
afterAll(async () => {
  await test.close();
});

beforeEach(async () => {
  baseline = { ...test.server.counters };
  // Each test records departures in its own map; a late callback from a previous test cannot leak in.
  const departures = new Map<number, number>();
  closed = departures;
  seats = await startPrototype(
    test.endpoint,
    2,
    42,
    "battle",
    (room, index) => {
      room.onLeave((code) => departures.set(index, code));
    },
  );
  await waitFor(
    () =>
      seats.seated.every(
        (entry) => receivedState(entry.room).phase === "battle",
      ),
    "fixture",
  );
});
afterEach(async () => {
  for (const entry of seats.seated) {
    // A client that used up its frame window has its consented-leave frame dropped,
    // so end the socket directly instead of waiting for the server to acknowledge.
    const transport = entry.room.connection.transport as unknown as {
      ws: { close(): void };
    };
    transport.ws.close();
  }
  await waitFor(() => test.server.counters.rooms === 0, "room disposal");
});

/** Counter change since this test began. */
function count(name: keyof Counters): number {
  return test.server.counters[name] - baseline[name];
}

function send(index: number, payload: unknown, type = "move"): void {
  seats.seated[index]?.room.send(type, payload);
}

function sendRaw(index: number, bytes: Uint8Array): void {
  const transport = seats.seated[index]?.room.connection
    .transport as unknown as {
    ws: { send(data: Uint8Array): void };
  };
  transport.ws.send(bytes);
}

/** A ROOM_DATA `move` frame of exactly `size` bytes, padded inside the msgpack payload. */
function moveFrameOfSize(size: number): Uint8Array {
  const header = Buffer.from([ROOM_DATA, 0xa4, ...Buffer.from("move")]);
  for (let pad = 0; pad < 4 * MAX_FRAME_BYTES; pad += 1) {
    const frame = Buffer.concat([
      header,
      pack({ direction: "up", pad: "x".repeat(pad) }),
    ]);
    if (frame.length === size) return frame;
  }
  throw new Error(`Cannot build a ${size}-byte frame`);
}

async function tickAll(count: number): Promise<void> {
  const before = receivedState(seats.seated[1]?.room as never).tick;
  test.server.advanceTicks(count);
  await waitFor(
    () => receivedState(seats.seated[1]?.room as never).tick === before + count,
    "ticks reach the other client",
  );
}

function ship(viewer: number, seat: number) {
  return receivedState(seats.seated[viewer]?.room as never).ships.find(
    (s) => s.seat === seat,
  );
}

describe("A02 per-connection frame window", () => {
  it("accepts exactly 30 frames in a window and drops the 31st", async () => {
    for (let index = 0; index < MAX_ACTIONS_PER_WINDOW; index += 1)
      send(0, { direction: "down" });
    send(0, { direction: "up" });
    await waitFor(() => count("framesDropped") === 1, "31st frame dropped");
    expect(count("inputsAccepted")).toBe(MAX_ACTIONS_PER_WINDOW);
    await tickAll(2);
    // The dropped frame never changed the intent: the ship went down, not up.
    expect(ship(1, 0)).toMatchObject({ x: 13, y: 12, facing: "down" });
  });

  it("resets exactly at the window boundary on the injected clock", async () => {
    for (let index = 0; index < MAX_ACTIONS_PER_WINDOW; index += 1)
      send(0, { direction: "down" });
    send(0, { direction: "up" });
    await waitFor(() => count("framesDropped") === 1, "dropped");
    clock.advance(FRAME_WINDOW_MS - 1);
    send(0, { direction: "up" });
    await waitFor(() => count("framesDropped") === 2, "still the same window");
    clock.advance(1);
    send(0, { direction: "up" });
    await waitFor(
      () => count("inputsAccepted") === MAX_ACTIONS_PER_WINDOW + 1,
      "accepted in the next window",
    );
    await tickAll(2);
    expect(ship(1, 0)).toMatchObject({ y: 10, facing: "up" });
  });

  it("counts unknown message types against the same window", async () => {
    for (let index = 0; index < MAX_ACTIONS_PER_WINDOW; index += 1)
      send(0, {}, "teleport");
    send(0, { direction: "down" });
    await waitFor(() => count("framesDropped") === 1, "valid action dropped");
    expect(count("inputsRejected")).toBe(MAX_ACTIONS_PER_WINDOW);
    expect(count("inputsAccepted")).toBe(0);
    await tickAll(2);
    expect(ship(1, 0)).toMatchObject({ x: 13, y: 11 });
  });

  it("keeps another client's window independent", async () => {
    for (let index = 0; index < 100; index += 1) send(0, { direction: "down" });
    await waitFor(() => count("framesDropped") === 70, "flooder dropped");
    send(1, { direction: "up" });
    await waitFor(
      () => count("inputsAccepted") === MAX_ACTIONS_PER_WINDOW + 1,
      "B accepted",
    );
    await tickAll(2);
    expect(ship(1, 1)).toMatchObject({ y: 10 });
  });

  it("drops 31 to 60 frames per window forever without disconnecting", async () => {
    for (let window = 0; window < 4; window += 1) {
      for (let index = 0; index < FLOOD_FRAMES_PER_WINDOW; index += 1)
        send(0, { direction: "down" });
      await waitFor(
        () =>
          count("framesDropped") ===
          (window + 1) * (FLOOD_FRAMES_PER_WINDOW - 30),
        `window ${window} drained`,
      );
      clock.advance(FRAME_WINDOW_MS);
    }
    expect(count("floodDisconnects")).toBe(0);
    expect(Object.fromEntries(closed)).toEqual({});
  });

  it("closes only the offender after two consecutive flooded windows", async () => {
    const flood = FLOOD_FRAMES_PER_WINDOW + 1;
    for (let index = 0; index < flood; index += 1)
      send(0, { direction: "down" });
    await waitFor(
      () => count("framesDropped") === flood - 30,
      "first window drained",
    );
    expect(Object.fromEntries(closed)).toEqual({});
    clock.advance(FRAME_WINDOW_MS);
    for (let index = 0; index < flood; index += 1)
      send(0, { direction: "down" });
    await waitFor(() => count("floodDisconnects") === 1, "flood disconnect");
    await waitFor(() => closed.has(0), "offender closed");
    expect(closed.get(0)).toBe(1008);
    // The other client is untouched and keeps moving.
    expect(closed.has(1)).toBe(false);
    const accepted = count("inputsAccepted");
    send(1, { direction: "up" });
    await waitFor(() => count("inputsAccepted") > accepted, "B accepted");
    await tickAll(2);
    expect(ship(1, 1)).toMatchObject({ y: 10 });
    await waitFor(
      () => test.server.counters.players === 1,
      "offender seat released",
    );
  });

  it("forgives a quiet window between two flooded ones", async () => {
    const flood = FLOOD_FRAMES_PER_WINDOW + 1;
    for (let index = 0; index < flood; index += 1)
      send(0, { direction: "down" });
    await waitFor(() => count("framesDropped") === flood - 30, "first");
    clock.advance(2 * FRAME_WINDOW_MS);
    for (let index = 0; index < flood; index += 1)
      send(0, { direction: "down" });
    await waitFor(() => count("framesDropped") === 2 * (flood - 30), "second");
    expect(count("floodDisconnects")).toBe(0);
  });
});

describe("A02 frame size and malformed frames", () => {
  it("accepts a frame of exactly 1 KiB and closes only the sender for one byte more", async () => {
    const exact = moveFrameOfSize(MAX_FRAME_BYTES);
    expect(exact.length).toBe(MAX_FRAME_BYTES);
    sendRaw(1, exact);
    // Within the limit it reaches the handler, which refuses the extra key.
    await waitFor(() => count("inputsRejected") === 1, "1 KiB frame parsed");
    expect(Object.fromEntries(closed)).toEqual({});

    const tooBig = moveFrameOfSize(MAX_FRAME_BYTES + 1);
    expect(tooBig.length).toBe(MAX_FRAME_BYTES + 1);
    sendRaw(0, tooBig);
    await waitFor(() => closed.has(0), "oversized sender closed");
    expect(closed.get(0)).toBe(1009);
    expect(count("framesOversized")).toBe(1);
    expect(count("inputsRejected")).toBe(1);
    expect(closed.has(1)).toBe(false);
  });

  it("drops frames with unsupported protocol codes and text frames, and keeps the connection", async () => {
    sendRaw(0, Uint8Array.from([ROOM_INPUT_RELIABLE, 1, 2, 3]));
    sendRaw(
      0,
      Uint8Array.from([ROOM_DATA_BYTES, 0xa4, 0x6d, 0x6f, 0x76, 0x65, 1]),
    );
    sendRaw(0, Uint8Array.from([99]));
    sendRaw(0, new Uint8Array(0));
    (
      seats.seated[0]?.room.connection.transport as unknown as {
        ws: { send(d: string): void };
      }
    ).ws.send("move");
    await waitFor(() => count("framesRejected") === 5, "five frames rejected");
    expect(Object.fromEntries(closed)).toEqual({});
    send(0, { direction: "down" });
    await waitFor(() => count("inputsAccepted") === 1, "still works");
  });

  it("survives truncated and corrupt data frames without crashing the server or room", async () => {
    const move = [0xa4, 0x6d, 0x6f, 0x76, 0x65];
    // A string header that claims far more bytes than the frame holds is refused as an unknown type.
    sendRaw(0, Uint8Array.from([ROOM_DATA, 0xdb, 0xff, 0xff, 0xff, 0xff]));
    await waitFor(
      () => count("inputsRejected") === 1,
      "truncated frame refused",
    );
    // A never-used msgpack marker decodes to nothing valid and is refused as an invalid payload.
    sendRaw(0, Uint8Array.from([ROOM_DATA, ...move, 0xc1]));
    await waitFor(
      () => count("inputsRejected") === 2,
      "corrupt payload refused",
    );
    expect(closed.size).toBe(0);
    // A map that promises an entry it never delivers cannot be decoded: only that sender is closed.
    sendRaw(1, Uint8Array.from([ROOM_DATA, ...move, 0x81]));
    await waitFor(() => closed.has(1), "undecodable payload sender closed");
    expect(closed.has(0)).toBe(false);
    expect(test.server.counters.rooms).toBe(1);
    send(0, { direction: "down" });
    await waitFor(
      () => count("inputsAccepted") === 1,
      "room still serves the other client",
    );
  });

  it("never lets an exception in a frame handler escape the connection", async () => {
    // A numeric type, a zero-length type and a deeply nested payload all stay inside the connection.
    send(0, { direction: "down" }, "");
    send(0, JSON.parse(`${'{"a":'.repeat(40)}1${"}".repeat(40)}`));
    send(0, { direction: "down" });
    await waitFor(
      () => count("inputsAccepted") === 1,
      "later valid frame still handled",
    );
    expect(Object.fromEntries(closed)).toEqual({});
  });
});
