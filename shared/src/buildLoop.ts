import { BUILD_CONFIG } from "./config.ts";
import { generateDepositMap, type DepositMap } from "./depositMap.ts";
import { inWorld, isBeltCell, slotAt, stepFor, type Cell } from "./layout.ts";
import {
  stepMovement,
  type MovementShip,
  type BlockerKind,
} from "./movement.ts";
import { isPlainRecord, ownValue, type Direction } from "./protocol.ts";

export const ROOM_BUILD = "build_preview";
export type BuildAction =
  | { type: "fire" }
  | { type: "build"; kind: "wall" | "turret" }
  | { type: "upgrade"; kind: "blaster" | "hull" };
export type SeatRole = "alive" | "awaiting_respawn" | "permanently_eliminated";
export interface BuildSeat extends MovementShip {
  slot: number;
  role: SeatRole;
  scrap: number;
  hull: number;
  blasterLevel: number;
  hullLevel: number;
  fireReady: number;
  respawnAt: number;
  disconnectAt: number;
  connected: boolean;
}
export interface BuildEntity extends Cell {
  id: string;
  kind: BlockerKind | "pickup";
  slot: number;
  owner: number;
  hp: number;
  scrap: number;
}
export interface BuildFeedback {
  seat: number;
  text: string;
}
export interface BuildWorld {
  map: DepositMap;
  tick: number;
  age: number;
  phase: "build" | "battle" | "ended";
  revealed: boolean;
  endedAt: number;
  result: string;
  seats: BuildSeat[];
  entities: BuildEntity[];
  spent: number;
  abandoned: number;
  paid: number;
  nextId: number;
  queues: Map<number, BuildAction[]>;
  feedback: BuildFeedback[];
}

/** Exact, small action envelopes. Seat, tile, price and balance never come from a client. */
export function parseBuildAction(
  type: string | number,
  payload: unknown,
): BuildAction | undefined {
  if (type === "fire") return payload === undefined ? { type } : undefined;
  if (
    (type !== "build" && type !== "upgrade") ||
    !isPlainRecord(payload) ||
    Object.keys(payload).length !== 1
  )
    return undefined;
  const kind = ownValue(payload, "kind");
  if (type === "build" && (kind === "wall" || kind === "turret"))
    return { type, kind };
  if (type === "upgrade" && (kind === "blaster" || kind === "hull"))
    return { type, kind };
  return undefined;
}

export function createBuildWorld(
  seats: readonly number[],
  seed: number,
): BuildWorld {
  const map = generateDepositMap(seats, seed);
  return {
    map,
    tick: 0,
    age: 0,
    phase: "build",
    revealed: false,
    endedAt: 0,
    result: "",
    seats: map.seats.map((s) => ({
      ...s,
      x: s.spawn.x,
      y: s.spawn.y,
      facing: map.layout.slots[s.slot]?.spawnFacing ?? "right",
      alive: true,
      intent: "none",
      role: "alive",
      scrap: 0,
      hull: BUILD_CONFIG.hull,
      blasterLevel: 0,
      hullLevel: 0,
      fireReady: 0,
      respawnAt: 0,
      disconnectAt: 0,
      connected: true,
    })),
    entities: [
      ...map.seats.map((s): BuildEntity => ({
        ...s.core,
        id: `core-${s.slot}`,
        kind: "core",
        slot: s.slot,
        owner: s.seat,
        hp: BUILD_CONFIG.coreHull,
        scrap: 0,
      })),
      ...map.deposits.map((d): BuildEntity => ({
        ...d,
        kind: "deposit",
        owner: -1,
        hp:
          d.kind === "small"
            ? BUILD_CONFIG.smallDepositHull
            : BUILD_CONFIG.largeDepositHull,
      })),
    ],
    spent: 0,
    abandoned: 0,
    paid: 0,
    nextId: 0,
    queues: new Map(),
    feedback: [],
  };
}

export function queueBuildAction(
  world: BuildWorld,
  seat: number,
  action: BuildAction,
): boolean {
  const player = world.seats.find((s) => s.seat === seat);
  if (world.phase !== "build" || !player?.alive || !player.connected)
    return false;
  const queue = world.queues.get(seat) ?? [];
  if (queue.length >= BUILD_CONFIG.maxQueued) return false;
  // Fire is one bit of intent, not an unbounded burst queue.
  if (action.type !== "fire" || !queue.some((q) => q.type === "fire"))
    queue.push(action);
  world.queues.set(seat, queue);
  return true;
}
const same = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y;
const coreOf = (w: BuildWorld, s: BuildSeat) =>
  w.entities.find((e) => e.kind === "core" && e.owner === s.seat);
export const maxHull = (s: Pick<BuildSeat, "hullLevel">): number =>
  BUILD_CONFIG.hull + BUILD_CONFIG.hullBonus * s.hullLevel;

/** Pure query also used by the client's advisory tile highlight. */
export function placementReason(
  world: BuildWorld,
  player: BuildSeat,
  target: Cell,
): string | undefined {
  const core = coreOf(world, player);
  const reserved = world.map.seats.find((s) => s.seat === player.seat)?.spawn;
  if (!core) return "A living core is required.";
  if (
    !inWorld(world.map.layout, target) ||
    slotAt(world.map.layout, target) !== player.slot ||
    isBeltCell(world.map.layout, target) ||
    Math.abs(target.x - core.x) + Math.abs(target.y - core.y) >
      BUILD_CONFIG.radius
  )
    return "Outside your build area.";
  if (reserved && same(reserved, target))
    return "The respawn tile must stay clear.";
  if (
    world.entities.some((e) => same(e, target)) ||
    world.seats.some((s) => s.alive && same(s, target))
  )
    return "That tile is occupied.";
  return undefined;
}

function purchase(
  world: BuildWorld,
  player: BuildSeat,
  action: BuildAction,
): boolean {
  if (action.type === "fire") return false;
  let cost: number;
  let reason: string | undefined;
  let target: Cell | undefined;
  if (action.type === "build") {
    cost =
      action.kind === "wall" ? BUILD_CONFIG.wallCost : BUILD_CONFIG.turretCost;
    const d = stepFor(player.facing);
    target = { x: player.x + d.x, y: player.y + d.y };
    reason = placementReason(world, player, target);
  } else {
    const level =
      action.kind === "hull" ? player.hullLevel : player.blasterLevel;
    const costs =
      action.kind === "hull"
        ? BUILD_CONFIG.hullCosts
        : BUILD_CONFIG.blasterCosts;
    cost = costs[level] ?? 0;
    if (level >= costs.length) reason = "MAX — upgrade already at level 3.";
  }
  if (!reason && player.scrap < cost)
    reason = `Need ${cost} scrap for ${action.kind}.`;
  if (reason) {
    world.feedback.push({ seat: player.seat, text: reason });
    return false;
  }
  player.scrap -= cost;
  world.spent += cost;
  if (action.type === "build" && target) {
    world.entities.push({
      ...target,
      id: `structure-${world.nextId++}`,
      kind: action.kind,
      slot: player.slot,
      owner: player.seat,
      hp:
        action.kind === "wall"
          ? BUILD_CONFIG.wallHull
          : BUILD_CONFIG.turretHull,
      scrap: 0,
    });
  } else if (action.type === "upgrade") {
    if (action.kind === "hull") {
      player.hullLevel++;
      player.hull = Math.min(
        maxHull(player),
        player.hull + BUILD_CONFIG.hullBonus,
      );
    } else player.blasterLevel++;
  }
  world.feedback.push({
    seat: player.seat,
    text: `Purchased ${action.kind} for ${cost} scrap.`,
  });
  return true;
}

function death(world: BuildWorld, player: BuildSeat): void {
  player.alive = false;
  player.hull = 0;
  player.intent = "none";
  world.queues.delete(player.seat);
  if (player.scrap > 0) {
    const pickup = world.entities.find(
      (e) => e.kind === "pickup" && same(e, player),
    );
    if (pickup) pickup.scrap += player.scrap;
    else
      world.entities.push({
        x: player.x,
        y: player.y,
        id: `pickup-${world.nextId++}`,
        kind: "pickup",
        slot: slotAt(world.map.layout, player),
        owner: -1,
        hp: 0,
        scrap: player.scrap,
      });
    player.scrap = 0;
  }
  player.role = coreOf(world, player)
    ? "awaiting_respawn"
    : "permanently_eliminated";
  player.respawnAt =
    player.role === "awaiting_respawn"
      ? world.tick + BUILD_CONFIG.respawnTicks
      : 0;
}

export function departBuildSeat(
  world: BuildWorld,
  seat: number,
  disconnected: boolean,
): void {
  const player = world.seats.find((s) => s.seat === seat);
  if (!player || world.phase !== "build") return;
  player.connected = false;
  player.intent = "none";
  world.queues.delete(seat);
  if (disconnected) {
    if (!player.disconnectAt)
      player.disconnectAt = world.tick + BUILD_CONFIG.disconnectTicks;
  } else abandon(world, player);
}
function abandon(world: BuildWorld, player: BuildSeat): void {
  world.abandoned += player.scrap;
  player.scrap = 0;
  player.alive = false;
  player.role = "permanently_eliminated";
  player.respawnAt = 0;
  player.intent = "none";
  world.queues.delete(player.seat);
}

/** One authoritative stage step. The first loop deliberately freezes for inspection at battle reveal. */
export function stepBuildWorld(world: BuildWorld): void {
  world.age++;
  world.feedback = [];
  if (world.phase !== "build") return;
  world.tick++;
  const ordered = [...world.seats].sort((a, b) => a.seat - b.seat);
  const queues = world.queues;
  world.queues = new Map();
  // Purchase at start-of-tick position/facing; invalid requests do not hide a later valid request.
  for (const player of ordered.filter((s) => s.alive && s.connected)) {
    const actions = queues.get(player.seat) ?? [];
    for (const type of ["build", "upgrade"] as const) {
      for (const action of actions.filter((a) => a.type === type))
        if (purchase(world, player, action)) break;
    }
  }
  const moved = stepMovement(
    {
      layout: world.map.layout,
      beltActive: true,
      blockers: world.entities
        .filter((e) => e.kind !== "pickup")
        .map((e) => ({ ...e, kind: e.kind as BlockerKind })),
    },
    world.seats,
    world.tick,
  );
  moved.ships.forEach((ship) => {
    const player = world.seats.find((s) => s.seat === ship.seat);
    if (player) Object.assign(player, ship);
  });
  const hits: { seat: BuildSeat; target: BuildEntity; damage: number }[] = [];
  for (const player of ordered) {
    if (
      !player.alive ||
      !player.connected ||
      world.tick < player.fireReady ||
      !queues.get(player.seat)?.some((a) => a.type === "fire")
    )
      continue;
    player.fireReady = world.tick + BUILD_CONFIG.fireTicks;
    const delta = stepFor(player.facing);
    for (let range = 1; range <= BUILD_CONFIG.range; range++) {
      const cell = {
        x: player.x + delta.x * range,
        y: player.y + delta.y * range,
      };
      if (
        !inWorld(world.map.layout, cell) ||
        isBeltCell(world.map.layout, cell)
      )
        break;
      const target = world.entities.find(
        (e) =>
          e.kind !== "pickup" &&
          same(e, cell) &&
          !(e.kind === "wall" && e.owner === player.seat),
      );
      if (target) {
        // Build sectors are isolated: harvesting is the only damage source in this slice.
        if (target.kind === "deposit")
          hits.push({
            seat: player,
            target,
            damage:
              BUILD_CONFIG.damage +
              player.blasterLevel * BUILD_CONFIG.damageBonus,
          });
        break;
      }
    }
  }
  for (const hit of hits) {
    if (!world.entities.includes(hit.target)) continue;
    hit.target.hp -= hit.damage;
    if (hit.target.hp <= 0) {
      world.entities.splice(world.entities.indexOf(hit.target), 1);
      hit.seat.scrap += hit.target.scrap;
      world.paid += hit.target.scrap;
    }
  }
  for (const player of ordered) {
    if (player.role === "alive" && !player.alive) death(world, player);
  }
  for (const player of ordered.filter((s) => s.alive)) {
    const pickup = world.entities.find(
      (e) => e.kind === "pickup" && same(e, player),
    );
    if (pickup) {
      player.scrap += pickup.scrap;
      world.entities.splice(world.entities.indexOf(pickup), 1);
    }
  }
  // Tick 1800 still used build rules through damage; reveal precedes due respawns/send.
  if (world.tick === BUILD_CONFIG.buildTicks) {
    world.phase = "battle";
    world.revealed = true;
  }
  for (const player of ordered) {
    if (
      !player.connected &&
      player.disconnectAt > 0 &&
      world.tick >= player.disconnectAt
    )
      abandon(world, player);
    if (player.role !== "awaiting_respawn") continue;
    if (!coreOf(world, player)) {
      abandon(world, player);
      continue;
    }
    const origin = world.map.seats.find((s) => s.seat === player.seat);
    if (
      !origin ||
      world.tick < player.respawnAt ||
      world.seats.some((s) => s.alive && same(s, origin.spawn))
    )
      continue;
    player.x = origin.spawn.x;
    player.y = origin.spawn.y;
    player.facing = world.map.layout.slots[player.slot]
      ?.spawnFacing as Direction;
    player.alive = true;
    player.role = "alive";
    player.hull = maxHull(player);
    player.respawnAt = 0;
    player.fireReady = world.tick + 1;
    player.intent = "none";
  }
  const contenders = world.seats.filter(
    (s) => s.role !== "permanently_eliminated",
  );
  if (contenders.length <= 1) {
    world.phase = "ended";
    world.endedAt = world.age;
    world.result = contenders.length
      ? `Winner: seat ${contenders[0]?.seat}`
      : "Draw";
    for (const player of world.seats) player.intent = "none";
    world.queues.clear();
  }
}
