import { isPlayerCount, layoutFor, stepFor, type Layout } from "./layout.ts";
import type { MovementShip } from "./movement.ts";
import type { FixtureView } from "./protocol.ts";
import { assignSectorSlots } from "./sectorAssignment.ts";

/**
 * Entities of the local movement prototype. Cores and one deposit-like
 * sentinel per sector (the unowned sector included) give the visibility tests
 * unique, recognizable ids. Real generation of deposits belongs to E3.
 */
export interface FixtureEntity {
  id: string;
  kind: "core" | "deposit";
  x: number;
  y: number;
  /** Sector slot containing the entity. */
  slot: number;
}

export interface FixtureWorld {
  layout: Layout;
  view: FixtureView;
  seed: number;
  /** Slot with no owner, or `null` when every slot is owned. */
  unownedSlot: number | null;
  /** `seatSlots[i]` is the sector slot of `seats[i]` (join order). */
  seats: readonly number[];
  seatSlots: readonly number[];
  ships: MovementShip[];
  entities: FixtureEntity[];
}

/** Distance past the spawn tile, along the core-to-spawn direction, where the sentinel sits. */
const SENTINEL_OFFSET = 3;

/**
 * Build the prototype world for ordered, server-issued seat ids. Join order
 * plus player count and seed fully determine the result (E1 replay contract,
 * `assignSectorSlots` revision 1). The Belt is up for the build view only.
 */
export function createFixtureWorld(
  seats: readonly number[],
  seed: number,
  view: FixtureView,
): FixtureWorld {
  const playerCount = seats.length;
  if (!isPlayerCount(playerCount)) {
    throw new Error("A fixture needs 2 to 5 seats");
  }
  const layout = layoutFor(playerCount);
  const assignment = assignSectorSlots(playerCount, seed);
  const ships: MovementShip[] = [];
  const entities: FixtureEntity[] = [];
  seats.forEach((seat, rank) => {
    const slotIndex = assignment.ownedSlots[rank];
    const slot = slotIndex === undefined ? undefined : layout.slots[slotIndex];
    if (slotIndex === undefined || !slot) {
      throw new Error("Sector assignment does not cover every seat");
    }
    entities.push({
      id: `core-${slotIndex}`,
      kind: "core",
      x: slot.core.x,
      y: slot.core.y,
      slot: slotIndex,
    });
    const step = stepFor(slot.spawnFacing);
    entities.push({
      id: `deposit-${slotIndex}`,
      kind: "deposit",
      x: slot.spawn.x + step.x * SENTINEL_OFFSET,
      y: slot.spawn.y + step.y * SENTINEL_OFFSET,
      slot: slotIndex,
    });
    ships.push({
      seat,
      x: slot.spawn.x,
      y: slot.spawn.y,
      facing: slot.spawnFacing,
      alive: true,
      intent: "none",
    });
  });
  if (assignment.unownedSlot !== null) {
    const unowned = layout.slots[assignment.unownedSlot];
    if (!unowned) throw new Error("Unowned slot is outside the layout");
    entities.push({
      id: `deposit-${assignment.unownedSlot}`,
      kind: "deposit",
      x: unowned.originX + 11,
      y: unowned.originY + 11,
      slot: assignment.unownedSlot,
    });
  }
  return {
    layout,
    view,
    seed,
    unownedSlot: assignment.unownedSlot,
    seats,
    seatSlots: assignment.ownedSlots.slice(0, playerCount),
    ships,
    entities,
  };
}

export type Phase = "waiting" | "build" | "battle";

/**
 * Build-phase rule: a seat receives entities in its own sector only. Unowned
 * sectors, every other sector and the unowned slot are hidden until the Belt
 * drops; in battle everything is visible. A waiting room has no entities.
 */
export function entityVisibleToSlot(
  phase: Phase,
  ownSlot: number | null,
  entitySlot: number,
): boolean {
  if (phase === "battle") return true;
  if (phase === "build") return ownSlot !== null && ownSlot === entitySlot;
  return false;
}
