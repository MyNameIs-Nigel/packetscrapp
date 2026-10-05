import { sanitizeNickname } from "./names.ts";
import {
  FIXTURE_VIEWS,
  MAX_SEATS,
  MIN_FIXTURE_SEATS,
  PROTOCOL_VERSION,
  isPlainRecord,
  ownValue,
  type FixtureView,
} from "./protocol.ts";

export type JoinRejection =
  "malformed" | "protocol" | "environment" | "name_empty" | "name_too_long";

/**
 * Matchmaking refusals are HTTP statuses: the framework's router only maps
 * real HTTP status codes, so an application-specific number would collapse to
 * a bare 500. Several refusals share a status, so the stable message below is
 * what tells the client which one it got (`joinRejectionFromMessage`).
 * Messages never echo client input.
 */
export const JOIN_ERROR_CODES = {
  malformed: 400,
  protocol: 426,
  environment: 409,
  name_empty: 422,
  name_too_long: 422,
  origin: 403,
  capacity: 503,
  fixture: 400,
  body_too_large: 413,
} as const;

export type JoinErrorReason = keyof typeof JOIN_ERROR_CODES;

export const JOIN_ERROR_MESSAGES: Record<JoinErrorReason, string> = {
  malformed: "Join request is not valid.",
  protocol: "This client and server use different protocol versions.",
  environment: "This client and server belong to different environments.",
  name_empty: "Enter a nickname of 1 to 16 characters.",
  name_too_long: "Nicknames can be at most 16 characters.",
  origin: "This website is not allowed to join this server.",
  capacity: "The server is full. Try again shortly.",
  fixture: "Prototype room options are not valid.",
  body_too_large: "Join request is too large.",
};

export interface AdmittedJoin {
  /** Sanitized nickname. The only client-supplied value the server keeps. */
  name: string;
}

export type JoinResult =
  { ok: true; join: AdmittedJoin } | { ok: false; reason: JoinRejection };

/**
 * Validate join options. Version and environment are checked before the name
 * so a mismatched client is refused without any name processing. Keys other
 * than the three above (including a supplied seat or identity) are never
 * read: identity and seat always come from the server.
 */
export function parseJoinOptions(
  options: unknown,
  environment: string,
): JoinResult {
  if (!isPlainRecord(options)) return { ok: false, reason: "malformed" };
  const protocol = ownValue(options, "protocol");
  const clientEnvironment = ownValue(options, "environment");
  const name = ownValue(options, "name");
  if (
    typeof protocol !== "number" ||
    typeof clientEnvironment !== "string" ||
    typeof name !== "string"
  ) {
    return { ok: false, reason: "malformed" };
  }
  if (protocol !== PROTOCOL_VERSION) return { ok: false, reason: "protocol" };
  if (clientEnvironment !== environment) {
    return { ok: false, reason: "environment" };
  }
  const result = sanitizeNickname(name);
  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, join: { name: result.name } };
}

export interface FixtureOptions {
  seats: number;
  seed: number;
  view: FixtureView;
}

/**
 * Local movement prototype options. `seats` is the room size, `seed` the map
 * seed (unsigned 32-bit), `view` the fixture mode. All three are required so
 * joiners can only match a room created with identical settings.
 */
export function parseFixtureOptions(options: unknown): FixtureOptions | null {
  if (!isPlainRecord(options)) return null;
  const seats = ownValue(options, "seats");
  const seed = ownValue(options, "seed");
  const view = ownValue(options, "view");
  if (
    typeof seats !== "number" ||
    !Number.isInteger(seats) ||
    seats < MIN_FIXTURE_SEATS ||
    seats > MAX_SEATS
  ) {
    return null;
  }
  if (
    typeof seed !== "number" ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffff_ffff
  ) {
    return null;
  }
  const knownView = FIXTURE_VIEWS.find((candidate) => candidate === view);
  if (knownView === undefined) return null;
  return { seats, seed, view: knownView };
}

/** Map a refusal message from the server back to its reason; unknown text maps to `undefined`. */
export function joinRejectionFromMessage(
  message: string,
): JoinErrorReason | undefined {
  return (Object.keys(JOIN_ERROR_MESSAGES) as JoinErrorReason[]).find(
    (reason) => JOIN_ERROR_MESSAGES[reason] === message,
  );
}
