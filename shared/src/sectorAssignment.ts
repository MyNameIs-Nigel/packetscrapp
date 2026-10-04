import { createSeededRandom } from "./random.ts";

export interface RandomDraw {
  next(): number;
}

/** Zero-based row-major sector slot layout for D1 player counts. Revision 1. */
export type PlayerCount = 2 | 3 | 4 | 5;

export interface SectorAssignment {
  /** Slot left unowned, or `null` when every slot is owned. */
  unownedSlot: number | null;
  /**
   * Owned slot indexes in admitted-seat order.
   * `ownedSlots[seatIndex]` is the sector slot for that admitted seat.
   */
  ownedSlots: number[];
}

interface Layout {
  /** All sector slots in ascending zero-based row-major order. */
  slots: number[];
  /**
   * Permitted unowned candidates in ascending (row-major) order.
   * Empty when the layout has no unowned sector.
   */
  unownedCandidates: number[];
}

const LAYOUTS: Record<PlayerCount, Layout> = {
  2: { slots: [0, 1], unownedCandidates: [] },
  3: { slots: [0, 1, 2, 3], unownedCandidates: [0, 1, 2, 3] },
  4: { slots: [0, 1, 2, 3], unownedCandidates: [] },
  // Five-player center column only: top-center=1, bottom-center=4.
  5: { slots: [0, 1, 2, 3, 4, 5], unownedCandidates: [1, 4] },
};

function isPlayerCount(value: number): value is PlayerCount {
  return value === 2 || value === 3 || value === 4 || value === 5;
}

/**
 * Durstenfeld Fisher–Yates, revision 1: descending `i`,
 * `j = floor(next() * (i + 1))`, then swap `a[i]` with `a[j]`.
 */
export function fisherYatesShuffle<T>(items: T[], random: RandomDraw): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i >= 1; i -= 1) {
    const j = Math.floor(random.next() * (i + 1));
    const left = result[i];
    const right = result[j];
    if (left === undefined || right === undefined) {
      throw new Error("Fisher–Yates index out of range");
    }
    result[i] = right;
    result[j] = left;
  }
  return result;
}

/**
 * Assign sector slots for a fixed player count and map seed.
 *
 * Slot indexes are zero-based, row-major left-to-right then top-to-bottom.
 * When an unowned sector exists, draw it first with
 * `floor(next() * candidates.length)` over the permitted candidates in
 * ascending index order, then shuffle the remaining owned slots with the
 * revision-1 Fisher–Yates above. Two- and four-player layouts skip the
 * unowned draw and shuffle every slot. Admission order maps onto
 * `ownedSlots` without a second shuffle.
 */
export function assignSectorSlots(
  playerCount: number,
  seed: number,
): SectorAssignment {
  if (!isPlayerCount(playerCount)) {
    throw new Error("Player count must be 2, 3, 4, or 5");
  }
  const layout = LAYOUTS[playerCount];
  const random = createSeededRandom(seed);
  let unownedSlot: number | null = null;
  let owned: number[];
  if (layout.unownedCandidates.length > 0) {
    const pick = Math.floor(random.next() * layout.unownedCandidates.length);
    const chosen = layout.unownedCandidates[pick];
    if (chosen === undefined) {
      throw new Error("Unowned candidate index out of range");
    }
    unownedSlot = chosen;
    owned = layout.slots.filter((slot) => slot !== unownedSlot);
  } else {
    owned = layout.slots.slice();
  }
  return {
    unownedSlot,
    ownedSlots: fisherYatesShuffle(owned, random),
  };
}
