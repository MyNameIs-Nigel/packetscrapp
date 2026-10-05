/**
 * Read the synchronized room state defensively. The state is data from the
 * network: every field is checked rather than trusted, and only what this
 * client actually received is returned.
 */
export interface PlayerSummary {
  seat: number;
  name: string;
  bot: boolean;
  coreAlive: boolean;
  /** Present only when the server sent this client that seat's sector. */
  slot: number | undefined;
}

export interface ShipSummary {
  seat: number;
  x: number;
  y: number;
  facing: string;
  alive: boolean;
}

export interface EntitySummary {
  id: string;
  kind: string;
  x: number;
  y: number;
  slot: number;
}

export interface RoomView {
  phase: string;
  prototype: boolean;
  playerCount: number;
  tick: number;
  players: PlayerSummary[];
  ships: ShipSummary[];
  entities: EntitySummary[];
}

interface Collection {
  forEach(callback: (value: unknown) => void): void;
}

function isCollection(value: unknown): value is Collection {
  return (
    typeof value === "object" &&
    value !== null &&
    "forEach" in value &&
    typeof value.forEach === "function"
  );
}

function members(value: unknown): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  if (!isCollection(value)) return result;
  value.forEach((member) => {
    if (typeof member === "object" && member !== null) {
      result.push(member as Record<string, unknown>);
    }
  });
  return result;
}

function integer(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : fallback;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function readRoomView(state: unknown): RoomView {
  const record: Record<string, unknown> =
    typeof state === "object" && state !== null
      ? (state as Record<string, unknown>)
      : {};
  return {
    phase: text(record.phase, "waiting"),
    prototype: record.prototype === true,
    playerCount: integer(record.playerCount),
    tick: integer(record.tick),
    players: members(record.players)
      .map((player) => ({
        seat: integer(player.seat),
        name: text(player.name),
        bot: player.bot === true,
        coreAlive: player.coreAlive !== false,
        slot:
          typeof player.slot === "number" ? integer(player.slot) : undefined,
      }))
      .sort((a, b) => a.seat - b.seat),
    ships: members(record.ships)
      .map((ship) => ({
        seat: integer(ship.seat),
        x: integer(ship.x),
        y: integer(ship.y),
        facing: text(ship.facing, "right"),
        alive: ship.alive !== false,
      }))
      .sort((a, b) => a.seat - b.seat),
    entities: members(record.entities)
      .map((entity) => ({
        id: text(entity.id),
        kind: text(entity.kind),
        x: integer(entity.x),
        y: integer(entity.y),
        slot: integer(entity.slot),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}
