import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const expectedToolchain = { node: "24.21.0", npm: "11.19.0" };

async function filesAt(root, relative = "") {
  const current = join(root, relative);
  const stat = await lstat(current);
  if (stat.isSymbolicLink()) throw new Error("Artifact symlinks are forbidden");
  if (stat.isFile()) return [relative];
  if (!stat.isDirectory())
    throw new Error("Artifact contains a non-file entry");
  const files = [];
  for (const name of (await readdir(current)).sort()) {
    files.push(
      ...(await filesAt(root, relative ? `${relative}/${name}` : name)),
    );
  }
  return files;
}

/** Verify a staged, private directory. No activation, shell, network or filesystem mutation. */
export async function verifyDevelopmentArtifact(root, expectedSha) {
  if (!SHA.test(expectedSha))
    throw new Error("Expected full lowercase commit SHA");
  // Inspect the manifest itself and directory tree before reading any payload.
  const actual = (await filesAt(root)).sort();
  if (!actual.includes("manifest.json")) throw new Error("Missing manifest");
  const manifest = JSON.parse(
    await readFile(join(root, "manifest.json"), "utf8"),
  );
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest))
    throw new Error("Invalid manifest");
  if (manifest.sha !== expectedSha || !SHA.test(manifest.sha))
    throw new Error("Artifact SHA mismatch");
  if (manifest.environment !== "development" || manifest.dirty !== false)
    throw new Error("Requires clean development artifact");
  if (
    !Number.isInteger(manifest.protocolVersion) ||
    manifest.protocolVersion < 1
  )
    throw new Error("Invalid protocol");
  if (
    manifest.node !== expectedToolchain.node ||
    manifest.npm !== expectedToolchain.npm
  )
    throw new Error("Toolchain mismatch");
  if (
    !manifest.files ||
    typeof manifest.files !== "object" ||
    Array.isArray(manifest.files)
  )
    throw new Error("Missing file digests");
  const names = Object.keys(manifest.files).sort();
  if (
    !names.includes("server/server.mjs") ||
    !names.includes("client/index.html")
  )
    throw new Error("Missing client/server artifact");
  for (const name of names) {
    if (
      !/^(server|client)\/[A-Za-z0-9_./-]+$/.test(name) ||
      name.split("/").some((part) => !part || part === "." || part === "..") ||
      !DIGEST.test(manifest.files[name])
    )
      throw new Error("Unsafe artifact path or digest");
  }
  if (
    JSON.stringify(actual) !==
    JSON.stringify(["manifest.json", ...names].sort())
  )
    throw new Error("Missing or undeclared artifact files");
  for (const name of names) {
    const digest = createHash("sha256")
      .update(await readFile(join(root, name)))
      .digest("hex");
    if (digest !== manifest.files[name])
      throw new Error(`Digest mismatch: ${name}`);
  }
  return {
    sha: manifest.sha,
    environment: manifest.environment,
    protocol: manifest.protocolVersion,
    files: names.length,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const [root, sha, ...extra] = process.argv.slice(2);
    if (!root || !sha || extra.length)
      throw new Error(
        "Usage: node scripts/verify-development-artifact.mjs STAGED_DIRECTORY EXPECTED_FULL_SHA",
      );
    process.stdout.write(
      `${JSON.stringify(await verifyDevelopmentArtifact(resolve(root), sha))}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Artifact verification failed"}\n`,
    );
    process.exitCode = 1;
  }
}
