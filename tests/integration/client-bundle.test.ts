import { resolve } from "node:path";
import { build } from "vite";
import { describe, expect, it } from "vitest";

const config = resolve(import.meta.dirname, "../../client/vite.config.ts");

/** Build the client for one environment in memory and return its JavaScript. */
async function clientCode(environment: string): Promise<string> {
  const previous = process.env.PACKET_BUILD_ENV;
  process.env.PACKET_BUILD_ENV = environment;
  try {
    const result = await build({
      configFile: config,
      logLevel: "silent",
      build: { write: false },
    });
    const outputs = Array.isArray(result) ? result : [result];
    const code: string[] = [];
    for (const output of outputs) {
      if (!("output" in output)) continue;
      for (const chunk of output.output) {
        if (chunk.type === "chunk") code.push(chunk.code);
      }
    }
    return code.join("\n");
  } finally {
    if (previous === undefined) delete process.env.PACKET_BUILD_ENV;
    else process.env.PACKET_BUILD_ENV = previous;
  }
}

// Strings that belong only to the local movement prototype and its fixtures.
const PROTOTYPE_ONLY = [
  "Local movement prototype",
  "Local prototype",
  "Prototype only",
  "start-prototype",
  "Map seed (0 to 4294967295)",
  "Fixture view",
];

describe("public client builds exclude the local movement prototype", () => {
  it("includes the prototype and the local server only in a local build", async () => {
    const code = await clientCode("local");
    for (const marker of PROTOTYPE_ONLY) {
      expect(code.includes(marker), `local build has "${marker}"`).toBe(true);
    }
    expect(code.includes("http://127.0.0.1:2567")).toBe(true);
    expect(code.includes("`local`")).toBe(true);
  }, 60_000);

  it.each(["development", "production"])(
    "leaves every prototype control, label and localhost server out of a %s build",
    async (environment) => {
      const code = await clientCode(environment);
      for (const marker of PROTOTYPE_ONLY) {
        expect(
          code.includes(marker),
          `${environment} build has "${marker}"`,
        ).toBe(false);
      }
      expect(code.includes("http://127.0.0.1:2567")).toBe(false);
      expect(code.includes(`\`${environment}\``)).toBe(true);
      // The real client still ships: the waiting-room view and the board renderer.
      expect(code.includes("Waiting for more players")).toBe(true);
      expect(code.includes("Hidden sector")).toBe(true);
    },
    60_000,
  );
});
