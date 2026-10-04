import { Client } from "@colyseus/sdk";
import { afterAll, beforeAll, expect, it } from "vitest";
import { startServer, type RunningServer } from "../../server/src/server.ts";

let server: RunningServer | undefined;
beforeAll(async () => {
  server = await startServer({
    environment: "local",
    region: "local",
    host: "127.0.0.1",
    port: 0,
  });
});
afterAll(async () => {
  await server?.close();
});

it("serves metadata and accepts a real SDK connection", async () => {
  if (!server) throw new Error("Server did not start");
  const response = await fetch(`http://127.0.0.1:${server.port}/health`);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toMatchObject({
    environment: "local",
    protocolVersion: 1,
  });
  const client = new Client(`http://127.0.0.1:${server.port}`);
  const room = await client.joinOrCreate("foundation");
  expect(room.roomId).toBeTruthy();
  expect(room.sessionId).toBeTruthy();
  await room.leave();
});
