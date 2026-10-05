import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { Client } from "@colyseus/sdk";

const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
assert.equal(
  process.version,
  `v${manifest.node}`,
  "Use the pinned Node runtime",
);
for (const [path, digest] of Object.entries(manifest.files)) {
  const actual = createHash("sha256")
    .update(await readFile(join("dist", path)))
    .digest("hex");
  assert.equal(actual, digest, `${path} digest differs from manifest`);
}

const probe = createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const address = probe.address();
assert.ok(address && typeof address !== "string");
const port = address.port;
await new Promise((resolve, reject) =>
  probe.close((error) => (error ? reject(error) : resolve())),
);

const directory = await mkdtemp(join(tmpdir(), "packetscrapp-artifact-"));
const bundle = join(directory, "server.mjs");
await copyFile("dist/server/server.mjs", bundle);
const execute = promisify(execFile);
const clientOrigins = {
  local: "http://127.0.0.1:5173",
  development: "https://dev.packetscr.app",
  production: "https://packetscr.app",
};
const clientOrigin = clientOrigins[manifest.environment];
assert.ok(clientOrigin, `Unknown manifest environment ${manifest.environment}`);
const runtimeEnvironment = {
  PATH: process.env.PATH,
  PACKET_ENV: manifest.environment,
  PACKET_REGION: manifest.environment === "local" ? "local" : "nyc",
  PACKET_HOST: "127.0.0.1",
  PACKET_PORT: String(port),
  PACKET_CLIENT_ORIGIN: clientOrigin,
};
const child = spawn(process.execPath, [bundle], {
  cwd: directory,
  stdio: ["ignore", "pipe", "pipe"],
  env: runtimeEnvironment,
});
let output = "";
const exited = new Promise((resolve) => child.once("exit", resolve));
child.stdout.on("data", (chunk) => (output += String(chunk)));
child.stderr.on("data", (chunk) => (output += String(chunk)));

/** Poll health until the server reports the expected room count, within a bounded wait. */
async function waitForRooms(endpoint, rooms) {
  const deadline = Date.now() + 3000;
  for (;;) {
    const health = await (await globalThis.fetch(`${endpoint}/health`)).json();
    if (health.rooms === rooms) return health;
    assert.ok(Date.now() < deadline, `Rooms did not return to ${rooms}`);
    await delay(25);
  }
}

try {
  const endpoint = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 5000;
  let response;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`Artifact exited early: ${output}`);
    try {
      response = await globalThis.fetch(`${endpoint}/health`, {
        signal: globalThis.AbortSignal.timeout(500),
      });
      if (response.ok) break;
    } catch {
      // Wait for the bounded startup deadline.
    }
    await delay(50);
  }
  assert.ok(response?.ok, `Artifact did not become healthy: ${output}`);
  const health = await response.json();
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    clientOrigin,
    "Health must allow only the configured client origin",
  );
  // Canonical health document; the E0 field names are gone.
  assert.deepEqual(Object.keys(health).sort(), [
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
  ]);
  assert.equal(health.status, "ok");
  assert.equal(health.version, manifest.sha);
  assert.equal(health.environment, manifest.environment);
  assert.equal(health.region, runtimeEnvironment.PACKET_REGION);
  assert.equal(health.protocol, manifest.protocolVersion);
  assert.equal(health.maxRooms, 20);
  assert.equal(health.accepting, true);
  assert.equal(health.rooms, 0);
  assert.equal(health.players, 0);

  const joinOptions = {
    name: "Smoke",
    protocol: manifest.protocolVersion,
    environment: manifest.environment,
  };
  const room = await new Client(endpoint, {
    headers: { Origin: clientOrigin },
  }).joinOrCreate("match", joinOptions);
  room.onMessage("welcome", () => undefined);
  assert.ok(room.roomId);
  const afterJoin = await (await globalThis.fetch(`${endpoint}/health`)).json();
  assert.equal(afterJoin.rooms, 1);
  assert.equal(afterJoin.players, 1);
  // Origin, version and environment mismatches are refused before any seat is allocated.
  await assert.rejects(
    new Client(endpoint).joinOrCreate("match", joinOptions),
    (error) => error.code === 403,
  );
  await assert.rejects(
    new Client(endpoint, {
      headers: { Origin: "https://evil.example" },
    }).joinOrCreate("match", joinOptions),
    (error) => error.code === 403,
  );
  await assert.rejects(
    new Client(endpoint, { headers: { Origin: clientOrigin } }).joinOrCreate(
      "match",
      { ...joinOptions, protocol: manifest.protocolVersion - 1 },
    ),
    (error) => error.code === 426,
  );
  // The movement prototype exists only in a local artifact.
  const prototype = new Client(endpoint, {
    headers: { Origin: clientOrigin },
  }).joinOrCreate("prototype", {
    ...joinOptions,
    seats: 2,
    seed: 42,
    view: "battle",
  });
  if (manifest.environment === "local") {
    const prototypeRoom = await prototype;
    prototypeRoom.onMessage("welcome", () => undefined);
    await prototypeRoom.leave();
  } else {
    await assert.rejects(prototype);
  }
  await room.leave();
  const afterLeave = await waitForRooms(endpoint, 0);
  assert.equal(afterLeave.players, 0);
  const wrongEnvironment =
    manifest.environment === "local" ? "development" : "local";
  for (const [env, expected] of [
    [{ PATH: process.env.PATH }, /PACKET_ENV must be/],
    [{ ...runtimeEnvironment, PACKET_PORT: "invalid" }, /PACKET_PORT must be/],
    [
      { ...runtimeEnvironment, PACKET_MAX_ROOMS: "0" },
      /PACKET_MAX_ROOMS must be/,
    ],
    [
      {
        ...runtimeEnvironment,
        PACKET_ENV: wrongEnvironment,
        PACKET_REGION: wrongEnvironment === "local" ? "local" : "nyc",
        PACKET_CLIENT_ORIGIN: clientOrigins[wrongEnvironment],
      },
      /Artifact environment .* does not match/,
    ],
  ]) {
    await assert.rejects(
      execute(process.execPath, [bundle], {
        cwd: directory,
        env,
        timeout: 5000,
      }),
      (error) => error.code === 1 && expected.test(error.stderr),
    );
  }
  process.stdout.write(
    `Bare artifact ${manifest.sha} served canonical health, admitted an SDK client with the exact origin, refused other origins and versions, and rejected invalid/mismatched configuration\n`,
  );
} finally {
  child.kill("SIGTERM");
  await exited;
  await rm(directory, { recursive: true, force: true });
}
