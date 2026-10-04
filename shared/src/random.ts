import type { RandomSource } from "./index.ts";

/** Mulberry32, revision 1: a portable replay stream, never an identity/token source. */
export function createSeededRandom(seed: number): RandomSource {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new Error("Map seed must be an unsigned 32-bit integer");
  }
  let state = seed;
  return {
    next: () => {
      state = (state + 0x6d2b_79f5) >>> 0;
      let value = Math.imul(state ^ (state >>> 15), state | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
    },
  };
}
