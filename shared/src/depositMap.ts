import { DEPOSIT_CONFIG as CONFIG } from "./config.ts";
import {
  isPlayerCount,
  layoutFor,
  type Cell,
  type Layout,
  type SlotGeometry,
} from "./layout.ts";
import { createSeededRandom } from "./random.ts";
import { assignSectorSlots, type RandomDraw } from "./sectorAssignment.ts";

interface TemplateDeposit extends Cell {
  kind: "small" | "large";
}

export interface Deposit extends TemplateDeposit {
  id: string;
  slot: number;
  scrap: number;
}

export interface DepositMap {
  configRevision: string;
  seed: number;
  layout: Layout;
  unownedSlot: number | null;
  seats: { seat: number; slot: number; core: Cell; spawn: Cell; scrap: 0 }[];
  deposits: Deposit[];
  generation: {
    attemptLimit: number;
    ownedAttempts: number;
    unownedAttempts: number;
    ownedFallback: boolean;
    unownedFallback: boolean;
  };
}

const CORE: Cell = { x: 12, y: 12 };
const STEPS: readonly Cell[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];
const key = ({ x, y }: Cell) => y * 24 + x;
const distance = (a: Cell, b: Cell) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const OWNED_FALLBACK: readonly TemplateDeposit[] = [
  { x: 12, y: 9, kind: "small" },
  { x: 15, y: 12, kind: "small" },
  { x: 7, y: 12, kind: "small" },
  { x: 12, y: 17, kind: "small" },
  { x: 18, y: 12, kind: "small" },
  { x: 12, y: 6, kind: "small" },
  { x: 4, y: 12, kind: "small" },
  { x: 12, y: 21, kind: "small" },
  { x: 9, y: 15, kind: "large" },
  { x: 17, y: 17, kind: "large" },
];
const UNOWNED_FALLBACK: readonly TemplateDeposit[] = [4, 9, 14, 19].flatMap(
  (y, row) =>
    [4, 9, 14, 19].map((x) => ({ x, y, kind: row === 3 ? "large" : "small" })),
);

/** Row-major candidate enumeration and one draw per selected cell, without replacement. */
function drawTemplate(random: RandomDraw, owned: boolean): TemplateDeposit[] {
  const used = new Set<number>();
  const selected: TemplateDeposit[] = [];
  const bands = owned
    ? ([
        { kind: "small", count: 2, min: 3, max: 4 },
        { kind: "small", count: 4, min: 5, max: 7 },
        { kind: "small", count: 2, min: 8, max: 10 },
        { kind: "large", count: 1, min: 5, max: 7 },
        { kind: "large", count: 1, min: 8, max: 10 },
      ] as const)
    : ([
        { kind: "small", count: CONFIG.unownedSmall, min: 0, max: 48 },
        { kind: "large", count: CONFIG.unownedLarge, min: 0, max: 48 },
      ] as const);
  for (const band of bands) {
    for (let index = 0; index < band.count; index++) {
      const candidates: Cell[] = [];
      for (let y = CONFIG.interiorMin; y <= CONFIG.interiorMax; y++) {
        for (let x = CONFIG.interiorMin; x <= CONFIG.interiorMax; x++) {
          const cell = { x, y };
          const d = distance(CORE, cell);
          if (!used.has(key(cell)) && d >= band.min && d <= band.max)
            candidates.push(cell);
        }
      }
      const chosen = candidates[Math.floor(random.next() * candidates.length)];
      if (!chosen) throw new Error("Deposit candidate pool exhausted");
      used.add(key(chosen));
      selected.push({ ...chosen, kind: band.kind });
    }
  }
  return selected;
}

/** Cardinal flood-fill within one sector. Distances are path steps, not geometric distances. */
function flood(
  starts: readonly Cell[],
  obstacles: ReadonlySet<number>,
  minimum: number,
  maximum: number,
): Map<number, number> {
  const reached = new Map<number, number>();
  const queue: Cell[] = [];
  const add = (cell: Cell, steps: number) => {
    if (
      cell.x < minimum ||
      cell.x > maximum ||
      cell.y < minimum ||
      cell.y > maximum
    )
      return;
    const id = key(cell);
    if (obstacles.has(id) || reached.has(id)) return;
    reached.set(id, steps);
    queue.push(cell);
  };
  for (const start of starts) add(start, 0);
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index];
    if (!cell) throw new Error("Missing traversal cell");
    const steps = reached.get(key(cell)) ?? 0;
    for (const step of STEPS)
      add({ x: cell.x + step.x, y: cell.y + step.y }, steps + 1);
  }
  return reached;
}

/** Nearest reachable tile with a clear cardinal shot of at most eight tiles. */
function firingDistance(
  deposit: Cell,
  obstacles: ReadonlySet<number>,
  reached: ReadonlyMap<number, number>,
): number {
  let nearest = Infinity;
  for (const step of STEPS) {
    for (let range = 1; range <= CONFIG.blasterRange; range++) {
      const cell = {
        x: deposit.x + step.x * range,
        y: deposit.y + step.y * range,
      };
      if (
        cell.x < 0 ||
        cell.x >= 24 ||
        cell.y < 0 ||
        cell.y >= 24 ||
        obstacles.has(key(cell))
      )
        break;
      nearest = Math.min(nearest, reached.get(key(cell)) ?? Infinity);
    }
  }
  return nearest;
}

function validTemplate(
  deposits: readonly TemplateDeposit[],
  starts: readonly Cell[],
  owned: boolean,
): boolean {
  const obstacles = new Set(deposits.map(key));
  if (obstacles.size !== deposits.length) return false;
  if (owned) {
    if (deposits.some((deposit) => distance(CORE, deposit) <= 1)) return false;
    obstacles.add(key(CORE));
  }
  // Conservatively avoid all sector edges in owned templates: the actual
  // layouts only put Belt on internal edges. This works for every mirror/spawn.
  for (const start of starts) {
    const reached = flood([start], obstacles, owned ? 1 : 0, owned ? 22 : 23);
    const shots = deposits.map((deposit) => ({
      kind: deposit.kind,
      steps: firingDistance(deposit, obstacles, reached),
    }));
    if (shots.some(({ steps }) => !Number.isFinite(steps))) return false;
    if (
      owned &&
      !shots.some(({ kind, steps }) => kind === "small" && steps <= 4)
    )
      return false;
  }
  return starts.length > 0;
}

/** Internal sector borders only; the outer map edge is never an entry. Belt is down. */
function entries(layout: Layout, slot: SlotGeometry): Cell[] {
  const cells: Cell[] = [];
  for (let offset = 0; offset < 24; offset++) {
    if (slot.column > 0) cells.push({ x: 0, y: offset });
    if (slot.column + 1 < layout.columns) cells.push({ x: 23, y: offset });
    if (slot.row > 0) cells.push({ x: offset, y: 0 });
    if (slot.row + 1 < layout.rows) cells.push({ x: offset, y: 23 });
  }
  return cells;
}

function selectTemplate(
  random: RandomDraw,
  starts: readonly Cell[],
  owned: boolean,
  attemptLimit: number,
): {
  deposits: readonly TemplateDeposit[];
  attempts: number;
  fallback: boolean;
} {
  for (let attempt = 1; attempt <= attemptLimit; attempt++) {
    const deposits = drawTemplate(random, owned);
    if (validTemplate(deposits, starts, owned))
      return { deposits, attempts: attempt, fallback: false };
  }
  const deposits = owned ? OWNED_FALLBACK : UNOWNED_FALLBACK;
  // Fail closed if future config/fallback edits violate the geometry contract.
  if (!validTemplate(deposits, starts, owned))
    throw new Error("Invalid deposit fallback template");
  return { deposits, attempts: attemptLimit, fallback: true };
}

/**
 * Standalone E3 preparation; does not start a match or expose a network view.
 * Replay: pinned assignment stream restarts from seed; a separate Mulberry32
 * stream starts from the same seed for deposits, owned attempts then unowned
 * attempts. Canonical core (12,12) mirrors around local 23 for core offset 11.
 * Record configRevision, attemptLimit, seed and server-issued admission order.
 */
export function generateDepositMap(
  seats: readonly number[],
  seed: number,
  options: { attemptLimit?: number } = {},
): DepositMap {
  const count = seats.length;
  if (
    !isPlayerCount(count) ||
    new Set(seats).size !== count ||
    seats.some((seat) => !Number.isInteger(seat) || seat < 0 || seat >= 5)
  ) {
    throw new Error(
      "Map needs 2–5 distinct server-issued seats in admission order",
    );
  }
  const attemptLimit = options.attemptLimit ?? CONFIG.maxAttempts;
  if (
    !Number.isInteger(attemptLimit) ||
    attemptLimit < 0 ||
    attemptLimit > CONFIG.maxAttempts
  ) {
    throw new Error("Deposit attempt limit must be an integer from 0 to 16");
  }
  const layout = layoutFor(count);
  const assignment = assignSectorSlots(count, seed);
  const random = createSeededRandom(seed);
  // Validate all four core-adjacent spawns before any mirroring. This is
  // stronger than a single layout's chosen spawn and protects five-seat mirrors.
  const owned = selectTemplate(
    random,
    STEPS.map((step) => ({ x: CORE.x + step.x, y: CORE.y + step.y })),
    true,
    attemptLimit,
  );
  const unownedSlot =
    assignment.unownedSlot === null
      ? undefined
      : layout.slots[assignment.unownedSlot];
  const unowned = unownedSlot
    ? selectTemplate(random, entries(layout, unownedSlot), false, attemptLimit)
    : undefined;
  const deposits: Deposit[] = [];
  for (const slot of layout.slots) {
    const isOwned = slot.index !== assignment.unownedSlot;
    const template = isOwned ? owned : unowned;
    if (!template) throw new Error("Missing sector deposit template");
    template.deposits.forEach((deposit, index) => {
      const mirrorX = isOwned && slot.core.x - slot.originX === 11;
      const mirrorY = isOwned && slot.core.y - slot.originY === 11;
      deposits.push({
        id: `deposit-${slot.index}-${index}`,
        slot: slot.index,
        kind: deposit.kind,
        x: slot.originX + (mirrorX ? 23 - deposit.x : deposit.x),
        y: slot.originY + (mirrorY ? 23 - deposit.y : deposit.y),
        scrap: deposit.kind === "small" ? CONFIG.smallScrap : CONFIG.largeScrap,
      });
    });
  }
  return {
    configRevision: CONFIG.revision,
    seed,
    layout,
    unownedSlot: assignment.unownedSlot,
    seats: seats.map((seat, index) => {
      const assigned = assignment.ownedSlots[index];
      const slot = assigned === undefined ? undefined : layout.slots[assigned];
      if (!slot) throw new Error("Missing assigned sector");
      return {
        seat,
        slot: slot.index,
        core: { ...slot.core },
        spawn: { ...slot.spawn },
        scrap: 0,
      };
    }),
    deposits,
    generation: {
      attemptLimit,
      ownedAttempts: owned.attempts,
      unownedAttempts: unowned?.attempts ?? 0,
      ownedFallback: owned.fallback,
      unownedFallback: unowned?.fallback ?? false,
    },
  };
}
