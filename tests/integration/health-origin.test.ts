import { request } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  JOIN_ERROR_CODES,
  JOIN_ERROR_MESSAGES,
  MAX_PEER_CONNECTIONS,
  PROTOCOL_VERSION,
  ROOM_MATCH,
  isHealthDocument,
  joinRejectionFromMessage,
} from "../../shared/src/index.ts";
import { ManualClock } from "../fixtures/clock.ts";
import {
  LOCAL_ORIGIN,
  joinOptions,
  sdkClient,
  seat,
  startTestServer,
  waitFor,
  type Seated,
  type TestServer,
} from "../fixtures/server.ts";

let test: TestServer | undefined;
afterEach(async () => {
  await test?.close();
  test = undefined;
});

async function health(
  server: TestServer,
  headers: Record<string, string> = {},
): Promise<{ response: Response; body: unknown }> {
  const response = await fetch(`${server.endpoint}/health`, { headers });
  return { response, body: await response.json() };
}

describe("H01 canonical health", () => {
  it("serves exactly the documented fields, uncached, for the exact client origin", async () => {
    test = await startTestServer();
    const { response, body } = await health(test, {
      Origin: "https://evil.example",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    // CORS names the configured client origin only: never `*`, never the caller's origin.
    expect(response.headers.get("access-control-allow-origin")).toBe(
      LOCAL_ORIGIN,
    );
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
    expect(isHealthDocument(body)).toBe(true);
    expect(body).toEqual({
      status: "ok",
      region: "local",
      version: "local-uncommitted",
      environment: "local",
      protocol: PROTOCOL_VERSION,
      uptimeSeconds: 0,
      rooms: 0,
      players: 0,
      maxRooms: 20,
      accepting: true,
    });
  });

  it("answers a probe that sends no Origin and leaks nothing about the host", async () => {
    test = await startTestServer();
    const { response, body } = await health(test);
    expect(response.status).toBe(200);
    expect(Object.keys(body as object).sort()).toEqual(
      [
        "accepting",
        "environment",
        "maxRooms",
        "players",
        "protocol",
        "region",
        "rooms",
        "status",
        "uptimeSeconds",
        "version",
      ].sort(),
    );
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/127\.0\.0\.1|heap|rss|memory|platform|linux/i);
  });

  it("counts rooms and players as they change and reports uptime from the injected clock", async () => {
    const clock = new ManualClock();
    test = await startTestServer({}, { clock });
    clock.advance(5_999);
    expect(
      ((await health(test)).body as { uptimeSeconds: number }).uptimeSeconds,
    ).toBe(5);
    clock.advance(1);
    expect(
      ((await health(test)).body as { uptimeSeconds: number }).uptimeSeconds,
    ).toBe(6);

    const first = await seat(
      sdkClient(test.endpoint),
      ROOM_MATCH,
      joinOptions("A"),
    );
    const second = await seat(
      sdkClient(test.endpoint),
      ROOM_MATCH,
      joinOptions("B"),
      first.room.roomId,
    );
    expect(await health(test).then(({ body }) => body)).toMatchObject({
      rooms: 1,
      players: 2,
    });
    await first.room.leave();
    await second.room.leave();
    await waitFor(() => test?.server.counters.rooms === 0, "disposal");
    expect(await health(test).then(({ body }) => body)).toMatchObject({
      rooms: 0,
      players: 0,
    });
  });

  it("reports accepting:false at the room limit while staying live, and recovers", async () => {
    test = await startTestServer({ maxRooms: 2 });
    const first = await sdkClient(test.endpoint).create(
      ROOM_MATCH,
      joinOptions("A"),
    );
    const second = await sdkClient(test.endpoint).create(
      ROOM_MATCH,
      joinOptions("B"),
    );
    expect(await health(test).then(({ body }) => body)).toMatchObject({
      status: "ok",
      rooms: 2,
      maxRooms: 2,
      accepting: false,
    });

    // A new room is refused, with the capacity message and no side effects.
    await expect(
      sdkClient(test.endpoint).create(ROOM_MATCH, joinOptions("C")),
    ).rejects.toMatchObject({
      code: JOIN_ERROR_CODES.capacity,
      message: JOIN_ERROR_MESSAGES.capacity,
    });
    expect(test.server.counters).toMatchObject({
      rooms: 2,
      players: 2,
      capacityRejected: 1,
    });
    // The process is healthy and an existing room still has free seats.
    const joiner = await sdkClient(test.endpoint).joinById(
      first.roomId,
      joinOptions("D"),
    );
    expect(test.server.counters.players).toBe(3);

    await joiner.leave();
    await second.leave();
    await waitFor(() => test?.server.counters.rooms === 1, "one room freed");
    expect(await health(test).then(({ body }) => body)).toMatchObject({
      accepting: true,
      rooms: 1,
    });
    const again = await sdkClient(test.endpoint).create(
      ROOM_MATCH,
      joinOptions("E"),
    );
    expect(again.roomId).toBeTruthy();
    await again.leave();
    await first.leave();
  });

  it("maps the capacity message back to its reason", () => {
    expect(joinRejectionFromMessage(JOIN_ERROR_MESSAGES.capacity)).toBe(
      "capacity",
    );
  });
});

interface UpgradeResult {
  status: number | "upgraded";
}

/** Attempt a raw WebSocket upgrade with an arbitrary Origin header. */
function upgrade(
  server: TestServer,
  origin: string | undefined,
): Promise<UpgradeResult> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      Connection: "Upgrade",
      Upgrade: "websocket",
      "Sec-WebSocket-Version": "13",
      "Sec-WebSocket-Key": Buffer.from("0123456789abcdef").toString("base64"),
    };
    if (origin !== undefined) headers.Origin = origin;
    const req = request({
      host: "127.0.0.1",
      port: server.server.port,
      path: "/",
      headers,
    });
    req.on("response", (response) => {
      response.resume();
      resolve({ status: response.statusCode ?? 0 });
    });
    req.on("upgrade", (_response, socket) => {
      socket.destroy();
      resolve({ status: "upgraded" });
    });
    req.on("error", reject);
    req.end();
  });
}

async function post(
  server: TestServer,
  origin: string | undefined,
  body: unknown = joinOptions("Alex"),
): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (origin !== undefined) headers.Origin = origin;
  return fetch(`${server.endpoint}/matchmake/joinOrCreate/${ROOM_MATCH}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("H02 exact origin policy", () => {
  it.each([
    ["a foreign site", "https://evil.example"],
    ["a different port", "http://127.0.0.1:5174"],
    ["a different scheme", "https://127.0.0.1:5173"],
    ["localhost by name", "http://localhost:5173"],
    ["a trailing slash", `${LOCAL_ORIGIN}/`],
    ["a prefix of the origin", "http://127.0.0.1:517"],
    ["an origin with a suffix", `${LOCAL_ORIGIN}.evil.example`],
    ["the null origin", "null"],
    ["two origins", `${LOCAL_ORIGIN}, https://evil.example`],
    ["a different case", "HTTP://127.0.0.1:5173"],
  ])(
    "refuses matchmaking from %s without allocating anything",
    async (_label, origin) => {
      test = await startTestServer();
      const response = await post(test, origin);
      expect(response.status).toBe(403);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
      expect(await response.json()).toEqual({
        code: JOIN_ERROR_CODES.origin,
        error: JOIN_ERROR_MESSAGES.origin,
      });
      expect(test.server.counters).toMatchObject({ rooms: 0, players: 0 });
      expect(test.server.counters.originRejected).toBe(1);
    },
  );

  it("refuses matchmaking with no Origin header", async () => {
    test = await startTestServer();
    expect((await post(test, undefined)).status).toBe(403);
    await expect(
      sdkClient(test.endpoint, "").joinOrCreate(
        ROOM_MATCH,
        joinOptions("Alex"),
      ),
    ).rejects.toMatchObject({ code: 403 });
    expect(test.server.counters.rooms).toBe(0);
  });

  it("admits matchmaking from the exact origin with a single allow-origin header", async () => {
    test = await startTestServer();
    const response = await post(test, LOCAL_ORIGIN);
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      LOCAL_ORIGIN,
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
    expect(response.headers.get("vary")).toContain("Origin");
    await response.json();
  });

  it("answers preflight only for the exact origin", async () => {
    test = await startTestServer();
    const allowed = await fetch(
      `${test.endpoint}/matchmake/joinOrCreate/${ROOM_MATCH}`,
      {
        method: "OPTIONS",
        headers: {
          Origin: LOCAL_ORIGIN,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type",
        },
      },
    );
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      LOCAL_ORIGIN,
    );
    expect(allowed.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
    const refused = await fetch(
      `${test.endpoint}/matchmake/joinOrCreate/${ROOM_MATCH}`,
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.example",
          "Access-Control-Request-Method": "POST",
        },
      },
    );
    expect(refused.status).toBe(403);
    expect(refused.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("refuses matchmaking preflight without Origin and allocates nothing", async () => {
    test = await startTestServer();
    const refused = await fetch(
      `${test.endpoint}/matchmake/joinOrCreate/${ROOM_MATCH}`,
      {
        method: "OPTIONS",
        headers: { "Access-Control-Request-Method": "POST" },
      },
    );
    expect(refused.status).toBe(403);
    expect(refused.headers.get("access-control-allow-origin")).toBeNull();
    expect(refused.headers.get("access-control-allow-credentials")).toBeNull();
    expect(test.server.counters).toMatchObject({
      rooms: 0,
      players: 0,
      originRejected: 1,
    });
    expect((await health(test)).response.status).toBe(200);
  });

  it("refuses an oversized or undeclared matchmaking body before reading it", async () => {
    test = await startTestServer();
    const big = await post(test, LOCAL_ORIGIN, {
      ...joinOptions("Alex"),
      pad: "x".repeat(5000),
    });
    expect(big.status).toBe(413);
    expect(test.server.counters.rooms).toBe(0);
  });

  it.each([
    ["a foreign site", "https://evil.example", 403],
    ["no Origin", undefined, 403],
    ["a different port", "http://127.0.0.1:5174", 403],
    ["the exact origin", LOCAL_ORIGIN, "upgraded"],
  ] as const)(
    "decides WebSocket upgrades from %s",
    async (_label, origin, expected) => {
      test = await startTestServer();
      expect((await upgrade(test, origin)).status).toBe(expected);
      expect(test.server.counters.originRejected).toBe(
        expected === 403 ? 1 : 0,
      );
    },
  );
});

describe("H02 peer connection cap", () => {
  it("allows 20 concurrent connections from one peer, refuses the 21st, and recovers", async () => {
    test = await startTestServer(
      { maxRooms: 20 },
      { seatReservationSeconds: 1 },
    );
    const connected: Seated[] = [];
    // Four rooms of five seats make exactly twenty live WebSocket connections.
    for (let index = 0; index < MAX_PEER_CONNECTIONS; index += 1) {
      const roomId = connected[Math.floor(index / 5) * 5]?.room.roomId;
      const options = joinOptions(`P${index}`);
      connected.push(
        index % 5 === 0
          ? await seat(sdkClient(test.endpoint), ROOM_MATCH, options)
          : await seat(sdkClient(test.endpoint), ROOM_MATCH, options, roomId),
      );
    }
    expect(test.server.counters.players).toBe(MAX_PEER_CONNECTIONS);
    await expect(
      sdkClient(test.endpoint).joinOrCreate(ROOM_MATCH, joinOptions("Extra")),
    ).rejects.toBeDefined();
    expect(test.server.counters.peerCapRejected).toBe(1);
    expect(test.server.counters.players).toBe(MAX_PEER_CONNECTIONS);

    const leaving = connected.pop();
    await leaving?.room.leave();
    await waitFor(
      () => test?.server.counters.players === MAX_PEER_CONNECTIONS - 1,
      "a free slot",
    );
    const retry = await seat(
      sdkClient(test.endpoint),
      ROOM_MATCH,
      joinOptions("Again"),
      connected[15]?.room.roomId,
    );
    connected.push(retry);
    expect(test.server.counters.players).toBe(MAX_PEER_CONNECTIONS);
    for (const entry of connected) await entry.room.leave();
    await waitFor(
      () =>
        test?.server.counters.rooms === 0 && test.server.counters.players === 0,
      "all rooms disposed",
      5000,
    );
  });
});
