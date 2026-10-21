import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, expect, it } from "vitest";

const sha = "a".repeat(40);
const script = resolve("scripts/verify-development-artifact.mjs");
let root: string;
let manifest: {
  sha: string;
  dirty: boolean;
  environment: string;
  protocolVersion: number;
  node: string;
  npm: string;
  files: Record<string, string>;
};
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "packet-development-verifier-"));
  await mkdir(join(root, "server"));
  await mkdir(join(root, "client"));
  await writeFile(join(root, "server/server.mjs"), "// example bundle\n");
  await writeFile(join(root, "client/index.html"), "<!doctype html>\n");
  const files: Record<string, string> = {};
  for (const name of ["server/server.mjs", "client/index.html"])
    files[name] = createHash("sha256")
      .update(await readFile(join(root, name)))
      .digest("hex");
  manifest = {
    sha,
    dirty: false,
    environment: "development",
    protocolVersion: 2,
    node: "24.21.0",
    npm: "11.19.0",
    files,
  };
  await save();
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
async function save() {
  await writeFile(join(root, "manifest.json"), JSON.stringify(manifest));
}
function verify(expected = sha) {
  return execFileSync(process.execPath, [script, root, expected], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
it("verifies exact clean development payloads without modifying them", async () => {
  const before = await readFile(join(root, "manifest.json"), "utf8");
  expect(JSON.parse(verify())).toEqual({
    sha,
    environment: "development",
    protocol: 2,
    files: 2,
  });
  expect(await readFile(join(root, "manifest.json"), "utf8")).toBe(before);
});
it.each(["production", "local"])(
  "rejects a %s artifact",
  async (environment) => {
    manifest.environment = environment;
    await save();
    expect(() => verify()).toThrow();
  },
);
it("rejects dirty, mismatched SHA/toolchain/protocol and invalid expected SHA", async () => {
  for (const [field, value] of [
    ["dirty", true],
    ["sha", "b".repeat(40)],
    ["node", "24.19.0"],
    ["npm", "11.9.0"],
    ["protocolVersion", 0],
  ] as const) {
    const original = { ...manifest };
    Object.assign(manifest, { [field]: value });
    await save();
    expect(() => verify()).toThrow();
    manifest = original;
  }
  await save();
  expect(() => verify("main")).toThrow();
});
it("rejects payload tampering, missing and undeclared files", async () => {
  await writeFile(join(root, "server/server.mjs"), "tampered");
  expect(() => verify()).toThrow();
  await rm(join(root, "server/server.mjs"));
  expect(() => verify()).toThrow();
  await writeFile(join(root, "server/server.mjs"), "// example bundle\n");
  await writeFile(join(root, "client/extra.js"), "unlisted");
  expect(() => verify()).toThrow();
});
it("rejects traversal, absolute, duplicate-normalized paths and bad digests", async () => {
  for (const name of [
    "../outside",
    "/tmp/outside",
    "client/../manifest.json",
    "client//index.html",
    "client/./index.html",
  ]) {
    const original = { ...manifest.files };
    manifest.files[name] = "0".repeat(64);
    await save();
    expect(() => verify()).toThrow();
    manifest.files = original;
  }
  manifest.files["server/server.mjs"] = "bad";
  await save();
  expect(() => verify()).toThrow();
});
it("rejects symlink files, directories, manifest and artifact root", async () => {
  const target = join(root, "client/index.html");
  await rm(target);
  await symlink("../server/server.mjs", target);
  expect(() => verify()).toThrow();
  await rm(target);
  await writeFile(target, "<!doctype html>\n");
  await rm(join(root, "client"), { recursive: true });
  await symlink("server", join(root, "client"));
  expect(() => verify()).toThrow();
  await rm(join(root, "client"));
  await mkdir(join(root, "client"));
  await writeFile(target, "<!doctype html>\n");
  await rm(join(root, "manifest.json"));
  await symlink("client/index.html", join(root, "manifest.json"));
  expect(() => verify()).toThrow();
  await rm(join(root, "manifest.json"));
  await save();
  const link = `${root}-link`;
  try {
    await symlink(root, link);
    expect(() =>
      execFileSync(process.execPath, [script, link, sha], { stdio: "pipe" }),
    ).toThrow();
  } finally {
    await rm(link, { force: true });
  }
});
