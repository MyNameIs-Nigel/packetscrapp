import { describe, expect, it } from "vitest";
import {
  beltCells,
  inWorld,
  isBeltCell,
  layoutFor,
  slotAt,
  type PlayerCount,
} from "../../shared/src/index.ts";

// Expected values are transcribed from the accepted D1 movement/map contract.
const WORLDS: [PlayerCount, number, number][] = [
  [2, 48, 24],
  [3, 48, 48],
  [4, 48, 48],
  [5, 72, 48],
];

describe("D1 layouts", () => {
  it.each(WORLDS)("%i players use a %i x %i world", (count, width, height) => {
    const layout = layoutFor(count);
    expect(layout.width).toBe(width);
    expect(layout.height).toBe(height);
    expect(layout.slots).toHaveLength((width / 24) * (height / 24));
    expect(layout.slots.map((slot) => slot.index)).toEqual(
      layout.slots.map((_, index) => index),
    );
  });

  it("places the two-player cores and spawns from the D1 examples", () => {
    const [left, right] = layoutFor(2).slots;
    expect(left?.core).toEqual({ x: 12, y: 11 });
    expect(right?.core).toEqual({ x: 35, y: 11 });
    expect(left?.spawn).toEqual({ x: 13, y: 11 });
    expect(left?.spawnFacing).toBe("right");
    expect(right?.spawn).toEqual({ x: 34, y: 11 });
    expect(right?.spawnFacing).toBe("left");
  });

  it.each([3, 4] as const)("places %i-player 2 x 2 cores", (count) => {
    const cores = layoutFor(count).slots.map((slot) => slot.core);
    expect(cores).toEqual([
      { x: 12, y: 12 },
      { x: 35, y: 12 },
      { x: 12, y: 35 },
      { x: 35, y: 35 },
    ]);
  });

  it("places the five-player 3 x 2 cores and center-column spawns", () => {
    const slots = layoutFor(5).slots;
    expect(slots.map((slot) => slot.core)).toEqual([
      { x: 12, y: 12 },
      { x: 35, y: 12 },
      { x: 59, y: 12 },
      { x: 12, y: 35 },
      { x: 35, y: 35 },
      { x: 59, y: 35 },
    ]);
    expect(slots.map((slot) => slot.spawnFacing)).toEqual([
      "right",
      "down",
      "left",
      "right",
      "up",
      "left",
    ]);
    expect(slots[1]?.spawn).toEqual({ x: 35, y: 13 });
    expect(slots[4]?.spawn).toEqual({ x: 35, y: 34 });
  });

  it("keeps paired outer sectors the same distance from their nearest Belt", () => {
    const two = layoutFor(2).slots;
    // Left core to Belt cell x=23, right core to Belt cell x=24.
    expect(23 - (two[0]?.core.x ?? 0)).toBe((two[1]?.core.x ?? 0) - 24);
    const four = layoutFor(4).slots;
    expect(23 - (four[0]?.core.y ?? 0)).toBe((four[2]?.core.y ?? 0) - 24);
    expect(23 - (four[0]?.core.x ?? 0)).toBe((four[1]?.core.x ?? 0) - 24);
  });

  it("puts every spawn next to its core inside the same sector", () => {
    for (const count of [2, 3, 4, 5] as const) {
      const layout = layoutFor(count);
      for (const slot of layout.slots) {
        const distance =
          Math.abs(slot.spawn.x - slot.core.x) +
          Math.abs(slot.spawn.y - slot.core.y);
        expect(distance).toBe(1);
        expect(slotAt(layout, slot.spawn)).toBe(slot.index);
        expect(slotAt(layout, slot.core)).toBe(slot.index);
      }
    }
  });
});

describe("D1 Belt cells", () => {
  function cellsOf(count: PlayerCount): Set<string> {
    return new Set(beltCells(layoutFor(count)).map(({ x, y }) => `${x},${y}`));
  }

  function expected(
    width: number,
    height: number,
    columns: number[],
    rows: number[],
  ): Set<string> {
    const cells = new Set<string>();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (columns.includes(x) || rows.includes(y)) cells.add(`${x},${y}`);
      }
    }
    return cells;
  }

  it("matches the D1 table for every player count", () => {
    expect(cellsOf(2)).toEqual(expected(48, 24, [23, 24], []));
    expect(cellsOf(3)).toEqual(expected(48, 48, [23, 24], [23, 24]));
    expect(cellsOf(4)).toEqual(expected(48, 48, [23, 24], [23, 24]));
    expect(cellsOf(5)).toEqual(expected(72, 48, [23, 24, 47, 48], [23, 24]));
  });

  it("has no Belt on the outer edge and includes band intersections", () => {
    const layout = layoutFor(4);
    expect(isBeltCell(layout, { x: 0, y: 5 })).toBe(false);
    expect(isBeltCell(layout, { x: 47, y: 5 })).toBe(false);
    expect(isBeltCell(layout, { x: 5, y: 0 })).toBe(false);
    expect(isBeltCell(layout, { x: 5, y: 47 })).toBe(false);
    expect(isBeltCell(layout, { x: 23, y: 23 })).toBe(true);
    expect(isBeltCell(layout, { x: 24, y: 24 })).toBe(true);
    expect(isBeltCell(layout, { x: 22, y: 11 })).toBe(false);
    expect(isBeltCell(layout, { x: 23, y: 11 })).toBe(true);
  });

  it("treats cells outside the world as neither Belt nor inside", () => {
    const layout = layoutFor(2);
    expect(inWorld(layout, { x: -1, y: 0 })).toBe(false);
    expect(inWorld(layout, { x: 48, y: 0 })).toBe(false);
    expect(inWorld(layout, { x: 0, y: 24 })).toBe(false);
    expect(inWorld(layout, { x: 0.5, y: 0 })).toBe(false);
    expect(isBeltCell(layout, { x: 23, y: 24 })).toBe(false);
  });

  it("keeps spawn, core and their neighbors off the Belt", () => {
    for (const count of [2, 3, 4, 5] as const) {
      const layout = layoutFor(count);
      for (const slot of layout.slots) {
        expect(isBeltCell(layout, slot.core)).toBe(false);
        expect(isBeltCell(layout, slot.spawn)).toBe(false);
      }
    }
  });
});
