import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { PROTOCOL_VERSION } from "../shared/src/index.ts";

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
const npmVersion = process.env.npm_execpath
  ? execFileSync(process.execPath, [process.env.npm_execpath, "--version"], {
      encoding: "utf8",
    }).trim()
  : undefined;
if (
  process.version !== `v${rootPackage.engines.node}` ||
  npmVersion !== rootPackage.engines.npm
) {
  throw new Error(
    `Build requires Node ${rootPackage.engines.node} and npm ${rootPackage.engines.npm}`,
  );
}
const environment = process.env.PACKET_BUILD_ENV ?? "local";
if (!["local", "development", "production"].includes(environment)) {
  throw new Error("PACKET_BUILD_ENV must be local, development, or production");
}
const sha = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const dirty =
  execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], {
    encoding: "utf8",
  }).trim().length > 0;
if (environment !== "local" && dirty) {
  throw new Error("Development/production artifacts require a clean checkout");
}
// A candidate must contain only files emitted by this build, including its manifest.
await rm("dist", { recursive: true, force: true });
await mkdir("dist/server", { recursive: true });
await esbuild({
  entryPoints: ["server/src/main.ts"],
  outfile: "dist/server/server.mjs",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  packages: "bundle",
  banner: {
    js: "import { createRequire as createNodeRequire } from 'node:module'; const require = createNodeRequire(import.meta.url);",
  },
  define: {
    __BUILD_SHA__: JSON.stringify(sha),
    __BUILD_ENV__: JSON.stringify(environment),
  },
});
await viteBuild({ configFile: "client/vite.config.ts" });

async function filesUnder(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const current = join(path, entry.name);
    paths.push(
      ...(entry.isDirectory() ? await filesUnder(current) : [current]),
    );
  }
  return paths;
}

const files = [
  ...(await filesUnder("dist/server")),
  ...(await filesUnder("dist/client")),
];
const digests = {};
for (const path of files.sort()) {
  digests[relative("dist", path)] = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}
const manifest = {
  sha,
  dirty,
  environment,
  protocolVersion: PROTOCOL_VERSION,
  node: process.version.slice(1),
  npm: npmVersion,
  files: digests,
};
await writeFile("dist/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(
  `Built ${environment} candidate ${sha}${dirty ? " (dirty)" : ""}\n`,
);
