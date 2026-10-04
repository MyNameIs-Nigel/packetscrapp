import { execFile } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";

const execute = promisify(execFile);
const repository = resolve(import.meta.dirname, "../..");

it("rebuilds identical artifacts after removing obsolete output", async () => {
  const directory = await mkdtemp(join(tmpdir(), "packetscrapp-build-"));
  try {
    for (const path of [
      "package.json",
      ".gitignore",
      "client",
      "server",
      "shared",
      "scripts",
      "tsconfig.base.json",
    ]) {
      await cp(join(repository, path), join(directory, path), {
        recursive: true,
        filter: (source) => !source.split(/[\\/]/).includes("node_modules"),
      });
    }
    await symlink(
      join(repository, "node_modules"),
      join(directory, "node_modules"),
      "junction",
    );
    await execute("git", ["init", "--quiet"], { cwd: directory });
    await execute("git", ["add", "."], { cwd: directory });
    await execute(
      "git",
      [
        "-c",
        "user.name=Packet Scrapp fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "Build fixture",
      ],
      { cwd: directory },
    );
    const build = async () => {
      await execute(process.execPath, [join(repository, "scripts/build.mjs")], {
        cwd: directory,
        env: { ...process.env, PACKET_BUILD_ENV: "local" },
        timeout: 10_000,
      });
      return readFile(join(directory, "dist/manifest.json"), "utf8");
    };
    const first = await build();
    await mkdir(join(directory, "dist/server/obsolete"), { recursive: true });
    await writeFile(
      join(directory, "dist/server/obsolete/old.mjs"),
      "obsolete server output\n",
    );
    await writeFile(
      join(directory, "dist/client/old.js"),
      "obsolete client output\n",
    );
    expect(await build()).toBe(first);
    await expect(
      readFile(join(directory, "dist/server/obsolete/old.mjs")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      readFile(join(directory, "dist/client/old.js")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    // Release builds cannot claim an exact committed source state after a tracked edit.
    await writeFile(
      join(directory, "client/index.html"),
      "dirty build fixture\n",
    );
    await expect(
      execute(process.execPath, [join(repository, "scripts/build.mjs")], {
        cwd: directory,
        env: { ...process.env, PACKET_BUILD_ENV: "development" },
        timeout: 10_000,
      }),
    ).rejects.toThrow("require a clean checkout");
    await expect(
      execute(process.execPath, [join(repository, "scripts/build.mjs")], {
        cwd: directory,
        env: { ...process.env, npm_execpath: "", PACKET_BUILD_ENV: "local" },
        timeout: 10_000,
      }),
    ).rejects.toThrow("Build requires Node 24.21.0 and npm 11.19.0");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 20_000);
