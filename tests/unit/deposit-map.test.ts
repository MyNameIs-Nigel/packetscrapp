import { describe, expect, it } from "vitest";
import {
  DEPOSIT_CONFIG,
  generateDepositMap,
  isBeltCell,
  slotAt,
  type DepositMap,
} from "../../shared/src/index.ts";

const COUNTS = [2, 3, 4, 5] as const;
const TOTALS = [320, 760, 640, 1080];
const key = (x: number, y: number) => `${x},${y}`;

// Separate test traversal and ray checks, never the generator's validity helper.
function reachableShots(map: DepositMap, slot: number, owned: boolean) {
  const geometry = map.layout.slots[slot];
  if (!geometry) throw new Error("Missing slot");
  const deposits = map.deposits.filter((deposit) => deposit.slot === slot);
  const obstacles = new Set(deposits.map(({ x, y }) => key(x, y)));
  if (owned) obstacles.add(key(geometry.core.x, geometry.core.y));
  const pending: { x: number; y: number; distance: number }[] = [];
  const distances = new Map<string, number>();
  const add = (x: number, y: number, distance: number) => {
    if (
      x < geometry.originX ||
      x >= geometry.originX + 24 ||
      y < geometry.originY ||
      y >= geometry.originY + 24 ||
      obstacles.has(key(x, y)) ||
      distances.has(key(x, y)) ||
      (owned && isBeltCell(map.layout, { x, y }))
    )
      return;
    distances.set(key(x, y), distance);
    pending.push({ x, y, distance });
  };
  if (owned) add(geometry.spawn.x, geometry.spawn.y, 0);
  else {
    for (let offset = 0; offset < 24; offset++) {
      if (geometry.column > 0)
        add(geometry.originX, geometry.originY + offset, 0);
      if (geometry.column + 1 < map.layout.columns)
        add(geometry.originX + 23, geometry.originY + offset, 0);
      if (geometry.row > 0) add(geometry.originX + offset, geometry.originY, 0);
      if (geometry.row + 1 < map.layout.rows)
        add(geometry.originX + offset, geometry.originY + 23, 0);
    }
  }
  for (let i = 0; i < pending.length; i++) {
    const cell = pending[i];
    if (!cell) throw new Error("Missing cell");
    add(cell.x + 1, cell.y, cell.distance + 1);
    add(cell.x - 1, cell.y, cell.distance + 1);
    add(cell.x, cell.y + 1, cell.distance + 1);
    add(cell.x, cell.y - 1, cell.distance + 1);
  }
  return deposits.map((deposit) => {
    let nearest = Infinity;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      if (dx === undefined || dy === undefined) throw new Error("Missing step");
      for (let range = 1; range <= 8; range++) {
        const x = deposit.x + dx * range,
          y = deposit.y + dy * range;
        if (obstacles.has(key(x, y))) break;
        if (owned && isBeltCell(map.layout, { x, y })) break;
        nearest = Math.min(nearest, distances.get(key(x, y)) ?? Infinity);
      }
    }
    return { kind: deposit.kind, nearest };
  });
}

function checkMap(map: DepositMap) {
  const signatures: string[] = [];
  for (const geometry of map.layout.slots) {
    const owned = geometry.index !== map.unownedSlot;
    const deposits = map.deposits.filter(({ slot }) => slot === geometry.index);
    expect(deposits.filter(({ kind }) => kind === "small")).toHaveLength(
      owned ? 8 : 12,
    );
    expect(deposits.filter(({ kind }) => kind === "large")).toHaveLength(
      owned ? 2 : 4,
    );
    expect(new Set(deposits.map(({ x, y }) => key(x, y))).size).toBe(
      deposits.length,
    );
    for (const deposit of deposits) {
      expect(slotAt(map.layout, deposit)).toBe(geometry.index);
      expect(isBeltCell(map.layout, deposit)).toBe(false);
      expect(deposit.x - geometry.originX).toBeGreaterThanOrEqual(2);
      expect(deposit.x - geometry.originX).toBeLessThanOrEqual(21);
      expect(deposit.y - geometry.originY).toBeGreaterThanOrEqual(2);
      expect(deposit.y - geometry.originY).toBeLessThanOrEqual(21);
      expect(deposit.scrap).toBe(deposit.kind === "small" ? 10 : 40);
      if (owned) {
        expect(
          Math.abs(deposit.x - geometry.core.x) +
            Math.abs(deposit.y - geometry.core.y),
        ).toBeGreaterThan(1);
      }
    }
    expect(map.generation.ownedAttempts).toBeLessThanOrEqual(
      map.generation.attemptLimit,
    );
    expect(map.generation.unownedAttempts).toBeLessThanOrEqual(
      map.generation.attemptLimit,
    );
    const shots = reachableShots(map, geometry.index, owned);
    expect(shots.every(({ nearest }) => Number.isFinite(nearest))).toBe(true);
    if (owned) {
      expect(
        shots.some(({ kind, nearest }) => kind === "small" && nearest <= 4),
      ).toBe(true);
      const signature = deposits
        .map(
          ({ kind, x, y }) =>
            `${kind}:${Math.abs(x - geometry.core.x) + Math.abs(y - geometry.core.y)}`,
        )
        .sort();
      signatures.push(JSON.stringify(signature));
      // Undo each mirror, retaining placement order: budgets alone would miss
      // a generator which independently scattered each owned sector.
      const canonical = deposits.map(({ kind, x, y }) => ({
        kind,
        x:
          geometry.core.x - geometry.originX === 11
            ? 23 - (x - geometry.originX)
            : x - geometry.originX,
        y:
          geometry.core.y - geometry.originY === 11
            ? 23 - (y - geometry.originY)
            : y - geometry.originY,
      }));
      const firstOwned = map.seats[0]?.slot;
      const firstGeometry =
        firstOwned === undefined ? undefined : map.layout.slots[firstOwned];
      if (!firstGeometry) throw new Error("Missing first owned sector");
      expect(canonical).toEqual(
        map.deposits
          .filter(({ slot }) => slot === firstOwned)
          .map(({ kind, x, y }) => ({
            kind,
            x:
              firstGeometry.core.x - firstGeometry.originX === 11
                ? 23 - (x - firstGeometry.originX)
                : x - firstGeometry.originX,
            y:
              firstGeometry.core.y - firstGeometry.originY === 11
                ? 23 - (y - firstGeometry.originY)
                : y - firstGeometry.originY,
          })),
      );
      for (const kind of ["small", "large"]) {
        const bands = [0, 0, 0];
        for (const deposit of deposits.filter((d) => d.kind === kind)) {
          const distance =
            Math.abs(deposit.x - geometry.core.x) +
            Math.abs(deposit.y - geometry.core.y);
          const band = distance <= 4 ? 0 : distance <= 7 ? 1 : 2;
          expect(distance).toBeGreaterThanOrEqual(3);
          expect(distance).toBeLessThanOrEqual(10);
          bands[band] = (bands[band] ?? 0) + 1;
        }
        expect(bands).toEqual(kind === "small" ? [2, 4, 2] : [0, 1, 1]);
      }
    }
  }
  expect(new Set(signatures).size).toBe(1);
  expect(new Set(map.deposits.map(({ id }) => id)).size).toBe(
    map.deposits.length,
  );
}

describe("D1 seeded deposit map preparation", () => {
  it.each(COUNTS)(
    "validates all %i-seat layouts over an independent geometry corpus",
    (count) => {
      for (const seed of [
        0,
        1,
        42,
        0xffffffff,
        ...Array.from({ length: 64 }, (_, i) => i + 2),
      ]) {
        const seats = Array.from({ length: count }, (_, i) => i);
        const map = generateDepositMap(seats, seed);
        checkMap(map);
        expect(map.deposits.reduce((sum, d) => sum + d.scrap, 0)).toBe(
          TOTALS[count - 2],
        );
      }
    },
  );

  it.each(COUNTS)("verifies the bounded fallback for %i seats", (count) => {
    const map = generateDepositMap(
      Array.from({ length: count }, (_, i) => i),
      42,
      { attemptLimit: 0 },
    );
    checkMap(map);
    expect(map.generation.ownedFallback).toBe(true);
    expect(map.generation.unownedFallback).toBe(count % 2 === 1);
    expect(map.generation.attemptLimit).toBe(0);
  });

  it("replays exact geometry and preserves pinned seat assignment and join order", () => {
    const seats = [4, 2, 0, 3, 1];
    const map = generateDepositMap(seats, 42);
    expect(map.seats.map(({ seat, slot }) => [seat, slot])).toEqual([
      [4, 1],
      [2, 0],
      [0, 5],
      [3, 3],
      [1, 2],
    ]);
    expect(map.unownedSlot).toBe(4);
    expect(map).toEqual(generateDepositMap(seats, 42));
    expect(map.deposits).not.toEqual(generateDepositMap(seats, 43).deposits);
    expect(map.configRevision).toBe(DEPOSIT_CONFIG.revision);
    expect(map.seats.every(({ scrap }) => scrap === 0)).toBe(true);
    // A caller cannot mutate the static fallback or another generated room.
    const firstDeposit = map.deposits[0];
    if (!firstDeposit) throw new Error("Missing deposit");
    firstDeposit.x = -999;
    expect(generateDepositMap(seats, 42).deposits[0]?.x).not.toBe(-999);
  });

  it.each([[0], [0, 0], [0, 1.5], [0, -1], [0, 5], [0, 1, 2, 3, 4, 5]])(
    "rejects invalid seats %j",
    (...seats) => {
      expect(() => generateDepositMap(seats, 42)).toThrow();
    },
  );
  it.each([-1, NaN, 0.5, 0x100000000])("rejects seed %s", (seed) => {
    expect(() => generateDepositMap([0, 1], seed)).toThrow();
  });
  it.each([-1, 0.5, 17, Infinity])(
    "rejects unbounded attempt limit %s",
    (attemptLimit) => {
      expect(() => generateDepositMap([0, 1], 42, { attemptLimit })).toThrow();
    },
  );
});
