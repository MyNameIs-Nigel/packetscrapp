/**
 * Private structured events. Only the allowlisted fields below ever reach the
 * sink, and every value must be a number, a boolean or a short identifier, so
 * a nickname, payload, address, reconnect token or other credential cannot be
 * logged by accident.
 */
export type LogEventType =
  | "server_started"
  | "server_stopped"
  | "room_created"
  | "room_disposed"
  | "player_joined"
  | "player_left"
  | "join_rejected"
  | "origin_rejected"
  | "peer_cap_rejected"
  | "capacity_rejected"
  | "frame_dropped"
  | "frame_rejected"
  | "flood_disconnect"
  | "input_rejected"
  | "internal_error";

const ALLOWED_FIELDS = new Set([
  "reason",
  "code",
  "count",
  "rooms",
  "players",
  "seat",
  "phase",
  "type",
  "transport",
]);

// Identifier-shaped values only: no addresses, no spaces, no free text.
const SAFE_STRING = /^[a-z][a-z0-9_]{0,63}$/;

export type LogFields = Record<string, string | number | boolean>;

export interface LogContext {
  environment: string;
  region: string;
  version: string;
}

export interface Logger {
  event(type: LogEventType, fields?: LogFields): void;
}

export type LogSink = (line: string) => void;

export function createLogger(
  context: LogContext,
  sink: LogSink,
  now: () => number = Date.now,
): Logger {
  return {
    event(type, fields = {}) {
      const safe: Record<string, string | number | boolean> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (!ALLOWED_FIELDS.has(key)) continue;
        if (typeof value === "string") {
          safe[key] = SAFE_STRING.test(value) ? value : "redacted";
        } else if (typeof value === "number") {
          safe[key] = Number.isFinite(value) ? value : -1;
        } else {
          safe[key] = value;
        }
      }
      sink(
        JSON.stringify({
          event: type,
          environment: context.environment,
          region: context.region,
          version: context.version,
          at: new Date(now()).toISOString(),
          ...safe,
        }),
      );
    },
  };
}

export const silentSink: LogSink = () => undefined;
export const stdoutSink: LogSink = (line) => {
  process.stdout.write(`${line}\n`);
};
