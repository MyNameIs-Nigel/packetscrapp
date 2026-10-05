/**
 * Wire contract between the browser client and the authoritative server.
 *
 * Version 2 replaces the E0 health fields (`sha`, `protocolVersion`) with the
 * canonical `version` / `protocol` pair and adds exact join and message
 * validation. Bump this for any change an old client could not handle.
 */
export const PROTOCOL_VERSION = 2;

/** Room type for the ordinary waiting room (roster only). */
export const ROOM_MATCH = "match";
/** Room type for the labelled local movement prototype. Registered only when the server runs in `local`. */
export const ROOM_PROTOTYPE = "prototype";

export const MAX_SEATS = 5;
export const MIN_FIXTURE_SEATS = 2;

export const TICK_RATE_HZ = 15;
export const TICK_INTERVAL_MS = 1000 / TICK_RATE_HZ;
/** A ship attempts one tile on even-numbered match ticks (2, 4, 6, ...). */
export const MOVEMENT_TICK_DIVISOR = 2;

/** Application WebSocket frames above this size are rejected before parsing. */
export const MAX_FRAME_BYTES = 1024;
/** One fixed, monotonic window per connection; it opens when the connection is accepted. */
export const FRAME_WINDOW_MS = 1000;
export const MAX_ACTIONS_PER_WINDOW = 30;
export const FLOOD_FRAMES_PER_WINDOW = 60;
export const FLOOD_WINDOWS_TO_DISCONNECT = 2;
export const MAX_PEER_CONNECTIONS = 20;
export const DEFAULT_MAX_ROOMS = 20;
/** Matchmaking request bodies larger than this are refused (join options are tiny). */
export const MAX_JOIN_BODY_BYTES = 4096;

export const NAME_MAX_CODE_POINTS = 16;
/** Longest raw name string examined before normalization; longer input is rejected, never truncated. */
export const NAME_MAX_RAW_UNITS = 1024;

export const DIRECTIONS = ["up", "down", "left", "right"] as const;
export type Direction = (typeof DIRECTIONS)[number];
export type MoveIntent = Direction | "none";

/** Client-to-server message types. Anything else is dropped and counted. */
export const MESSAGE_MOVE = "move";
/** Server-to-client private message carrying the admitted seat. */
export const MESSAGE_WELCOME = "welcome";

export interface WelcomeMessage {
  seat: number;
  protocol: number;
}

export type FixtureView = "build" | "battle";
export const FIXTURE_VIEWS: readonly FixtureView[] = ["build", "battle"];

/** Public health document. See docs/REGIONS_AND_HEALTH.md. */
export interface HealthDocument {
  status: "ok";
  region: string;
  version: string;
  environment: string;
  protocol: number;
  uptimeSeconds: number;
  rooms: number;
  players: number;
  maxRooms: number;
  accepting: boolean;
}

const HEALTH_KEYS: readonly (keyof HealthDocument)[] = [
  "status",
  "region",
  "version",
  "environment",
  "protocol",
  "uptimeSeconds",
  "rooms",
  "players",
  "maxRooms",
  "accepting",
];

/** True only for a health body with the exact canonical shape. */
export function isHealthDocument(value: unknown): value is HealthDocument {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== HEALTH_KEYS.length ||
    !HEALTH_KEYS.every((key) => key in record)
  ) {
    return false;
  }
  const integer = (field: unknown): boolean =>
    typeof field === "number" && Number.isInteger(field) && field >= 0;
  return (
    record.status === "ok" &&
    typeof record.region === "string" &&
    typeof record.version === "string" &&
    typeof record.environment === "string" &&
    integer(record.protocol) &&
    integer(record.uptimeSeconds) &&
    integer(record.rooms) &&
    integer(record.players) &&
    integer(record.maxRooms) &&
    typeof record.accepting === "boolean"
  );
}

/**
 * A client may use a region only when it is running normally, accepting
 * players, and agrees on both protocol and environment.
 */
export function isJoinableHealth(
  health: HealthDocument,
  environment: string,
): boolean {
  return (
    health.status === "ok" &&
    health.accepting &&
    health.protocol === PROTOCOL_VERSION &&
    health.environment === environment
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownValue(record: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

/**
 * Validate a `move` payload: exactly `{ direction }` with an enum value.
 * Returns `undefined` for anything else so the previous intent is untouched.
 */
export function parseMovePayload(payload: unknown): MoveIntent | undefined {
  if (!isPlainRecord(payload)) return undefined;
  const keys = Reflect.ownKeys(payload);
  if (keys.length !== 1 || keys[0] !== "direction") return undefined;
  const direction = ownValue(payload, "direction");
  if (direction === "none") return "none";
  return DIRECTIONS.find((candidate) => candidate === direction);
}

export { isPlainRecord, ownValue };
