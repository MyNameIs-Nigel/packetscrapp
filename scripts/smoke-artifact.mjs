import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
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
const child = spawn(process.execPath, [bundle], {
  cwd: directory,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    PATH: process.env.PATH,
    PACKET_ENV: manifest.environment,
    PACKET_REGION: manifest.environment === "local" ? "local" : "nyc",
    PACKET_HOST: "127.0.0.1",
    PACKET_PORT: String(port),
  },
});
let output = "";
const exited = new Promise((resolve) => child.once("exit", resolve));
child.stdout.on("data", (chunk) => (output += String(chunk)));
child.stderr.on("data", (chunk) => (output += String(chunk)));

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
  assert.equal(health.sha, manifest.sha);
  assert.equal(health.environment, manifest.environment);
  assert.equal(health.protocolVersion, manifest.protocolVersion);
  const room = await new Client(endpoint).joinOrCreate("foundation");
  assert.ok(room.roomId);
  await room.leave();
  process.stdout.write(
    `Bare artifact ${manifest.sha} started and accepted an SDK client\n`,
  );
} finally {
  child.kill("SIGTERM");
  await exited;
  await rm(directory, { recursive: true, force: true });
}
