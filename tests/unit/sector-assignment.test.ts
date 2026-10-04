import { describe, expect, it } from "vitest";
import { assignSectorSlots } from "../../shared/src/index.ts";

describe("sector assignment pin revision 1", () => {
  it.each([
    [2, 0, null, [1, 0]],
    [2, 1, null, [0, 1]],
    [2, 42, null, [0, 1]],
    [2, 4294967295, null, [0, 1]],
    [3, 0, 1, [2, 3, 0]],
    [3, 1, 2, [3, 1, 0]],
    [3, 42, 2, [0, 3, 1]],
    [3, 4294967295, 3, [2, 1, 0]],
    [4, 0, null, [3, 2, 0, 1]],
    [4, 1, null, [3, 1, 0, 2]],
    [4, 42, null, [0, 3, 1, 2]],
    [4, 4294967295, null, [2, 1, 0, 3]],
    [5, 0, 1, [2, 3, 4, 5, 0]],
    [5, 1, 4, [5, 1, 3, 2, 0]],
    [5, 42, 4, [1, 0, 5, 3, 2]],
    [5, 4294967295, 4, [5, 1, 3, 2, 0]],
  ] as const)(
    "pins player count %s seed %s",
    (playerCount, seed, unownedSlot, ownedSlots) => {
      // Vectors were recomputed independently with Python uint32 Mulberry32
      // and the Durstenfeld formula documented in E1_HANDOFF.md.
      expect(assignSectorSlots(playerCount, seed)).toEqual({
        unownedSlot,
        ownedSlots: [...ownedSlots],
      });
    },
  );

  it("keeps five-player unowned picks in the center column", () => {
    for (const seed of [0, 1, 42, 4294967295] as const) {
      const { unownedSlot, ownedSlots } = assignSectorSlots(5, seed);
      expect([1, 4]).toContain(unownedSlot);
      expect(ownedSlots).toHaveLength(5);
      expect(new Set(ownedSlots).size).toBe(5);
      expect(ownedSlots).not.toContain(unownedSlot);
      for (const slot of ownedSlots) {
        expect(slot).toBeGreaterThanOrEqual(0);
        expect(slot).toBeLessThanOrEqual(5);
      }
    }
  });

  it("rejects unsupported player counts", () => {
    expect(() => assignSectorSlots(1, 0)).toThrow("2, 3, 4, or 5");
    expect(() => assignSectorSlots(6, 0)).toThrow("2, 3, 4, or 5");
  });
});
