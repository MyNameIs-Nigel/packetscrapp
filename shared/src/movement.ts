import {
  inWorld,
  isBeltCell,
  stepFor,
  type Cell,
  type Layout,
} from "./layout.ts";
import {
  MOVEMENT_TICK_DIVISOR,
  type Direction,
  type MoveIntent,
} from "./protocol.ts";

/** Things a ship cannot enter. An owned wall is the only passable kind, and only for its owner. */
export type BlockerKind = "core" | "deposit" | "turret" | "wall";

export interface Blocker extends Cell {
  kind: BlockerKind;
  /** Seat index of the owner; meaningful for walls. */
  owner?: number;
}

export interface MovementShip extends Cell {
  seat: number;
  facing: Direction;
  alive: boolean;
  /** Latest validated intent. A rejected step never erases it. */
  intent: MoveIntent;
}

export interface MovementWorld {
  layout: Layout;
  /** True while the build-phase Belt is up. */
  beltActive: boolean;
  blockers: readonly Blocker[];
}

export type MoveOutcome =
  | "moved"
  | "belt_death"
  | "no_intent"
  | "outside_world"
  | "blocked_static"
  | "blocked_ship"
  | "contested";

export interface MoveEvent {
  seat: number;
  outcome: MoveOutcome;
  from: Cell;
  to: Cell;
}

export interface MovementResult {
  ships: MovementShip[];
  events: MoveEvent[];
}

/** Ships attempt a tile only on even-numbered match ticks (2, 4, 6, ...). */
export function isMovementTick(tick: number): boolean {
  return (
    Number.isInteger(tick) && tick > 0 && tick % MOVEMENT_TICK_DIVISOR === 0
  );
}

function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

/**
 * Resolve one tick of ship movement under the D1 contract. Pure: positions at
 * the start of the tick decide every intent, so swaps, chained moves and two
 * ships aiming at one tile all fail, and the input ships are not mutated.
 *
 * Facing changes only after a successful step, including a lethal Belt step.
 * A step beyond the world is rejected with position, facing and intent intact.
 * Belt deaths here classify the step; respawn and scrap drops belong to D2/E3.
 */
export function stepMovement(
  world: MovementWorld,
  ships: readonly MovementShip[],
  tick: number,
): MovementResult {
  const next = ships.map((ship) => ({ ...ship }));
  if (!isMovementTick(tick)) return { ships: next, events: [] };

  const occupied = new Set<string>();
  for (const ship of ships) {
    if (ship.alive) occupied.add(cellKey(ship));
  }
  const blockerAt = new Map<string, Blocker>();
  for (const blocker of world.blockers)
    blockerAt.set(cellKey(blocker), blocker);

  interface Proposal {
    index: number;
    from: Cell;
    to: Cell;
    direction: Direction;
  }
  const events: MoveEvent[] = [];
  const proposals: Proposal[] = [];
  const claims = new Map<string, number>();
  ships.forEach((ship, index) => {
    if (!ship.alive || ship.intent === "none") return;
    const direction = ship.intent;
    const step = stepFor(direction);
    const from = { x: ship.x, y: ship.y };
    const to = { x: ship.x + step.x, y: ship.y + step.y };
    const reject = (outcome: MoveOutcome): void => {
      events.push({ seat: ship.seat, outcome, from, to });
    };
    if (!inWorld(world.layout, to)) return reject("outside_world");
    const blocker = blockerAt.get(cellKey(to));
    if (blocker && !(blocker.kind === "wall" && blocker.owner === ship.seat)) {
      return reject("blocked_static");
    }
    if (occupied.has(cellKey(to))) return reject("blocked_ship");
    proposals.push({ index, from, to, direction });
    claims.set(cellKey(to), (claims.get(cellKey(to)) ?? 0) + 1);
  });

  for (const proposal of proposals) {
    const ship = next[proposal.index];
    const original = ships[proposal.index];
    if (!ship || !original) continue;
    if ((claims.get(cellKey(proposal.to)) ?? 0) > 1) {
      events.push({
        seat: original.seat,
        outcome: "contested",
        from: proposal.from,
        to: proposal.to,
      });
      continue;
    }
    ship.x = proposal.to.x;
    ship.y = proposal.to.y;
    ship.facing = proposal.direction;
    const lethal = world.beltActive && isBeltCell(world.layout, proposal.to);
    if (lethal) {
      ship.alive = false;
      ship.intent = "none";
    }
    events.push({
      seat: original.seat,
      outcome: lethal ? "belt_death" : "moved",
      from: proposal.from,
      to: proposal.to,
    });
  }
  return { ships: next, events };
}
