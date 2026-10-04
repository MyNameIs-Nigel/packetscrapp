import { describe, expect, it } from "vitest";
import { createSeededRandom } from "../../shared/src/index.ts";
import { ManualClock } from "../fixtures/clock.ts";

describe("deterministic fixtures", () => {
  it.each([
    [0, [1144304738, 1416247, 958946056]],
    [1, [2693262067, 11749833, 2265367787]],
    [42, [2581720956, 1925393290, 3661312704]],
    [4294967295, [3850105811, 813802916, 3073704848]],
  ])("pins the revision-1 random stream for seed %s", (seed, expected) => {
    // Integer reference vectors were calculated independently with Python uint32 arithmetic.
    const random = createSeededRandom(seed);
    expect(
      [random.next(), random.next(), random.next()].map(
        (value) => value * 2 ** 32,
      ),
    ).toEqual(expected);
  });

  it("replays independently and stays inside [0, 1)", () => {
    const first = createSeededRandom(42);
    const replay = createSeededRandom(42);
    const other = createSeededRandom(1);
    expect(other.next()).not.toBe(first.next());
    replay.next();
    for (let index = 0; index < 100; index++) {
      const value = first.next();
      expect(value).toBe(replay.next());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it.each([-1, 2 ** 32, 1.5, NaN, Infinity])(
    "rejects invalid seed %s",
    (seed) => {
      expect(() => createSeededRandom(seed)).toThrow("unsigned 32-bit");
    },
  );

  it("advances a manual clock across exact boundaries", () => {
    const clock = new ManualClock();
    clock.advance(19_999);
    expect(clock.now()).toBe(19_999);
    clock.advance(1);
    expect(clock.now()).toBe(20_000);
    clock.advance(1);
    expect(clock.now()).toBe(20_001);
    expect(() => clock.advance(-1)).toThrow("non-negative");
    expect(() => clock.advance(Infinity)).toThrow("finite");
    expect(clock.now()).toBe(20_001);
  });
});
