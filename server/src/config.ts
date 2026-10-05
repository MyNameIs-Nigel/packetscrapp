import { DEFAULT_MAX_ROOMS } from "@packetscrapp/shared";

export type Environment = "local" | "development" | "production";

export interface ServerConfig {
  environment: Environment;
  region: string;
  host: string;
  port: number;
  /** The one browser origin admitted for HTTP and WebSocket requests. */
  clientOrigin: string;
  /** Rooms this process will hold at once; the server reports `accepting: false` at the limit. */
  maxRooms: number;
}

const environments = new Set<Environment>([
  "local",
  "development",
  "production",
]);

export const LOCAL_CLIENT_ORIGIN = "http://127.0.0.1:5173";
export const DEVELOPMENT_CLIENT_ORIGIN = "https://dev.packetscr.app";
const MAX_ROOMS_CEILING = 1000;

function isExactOrigin(value: string): boolean {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}

function parseClientOrigin(
  environment: Environment,
  value: string | undefined,
): string {
  if (environment === "local") {
    if (value !== undefined && value !== LOCAL_CLIENT_ORIGIN) {
      throw new Error(
        `PACKET_CLIENT_ORIGIN must be ${LOCAL_CLIENT_ORIGIN} in local mode`,
      );
    }
    return LOCAL_CLIENT_ORIGIN;
  }
  if (!value || !isExactOrigin(value)) {
    throw new Error(
      "PACKET_CLIENT_ORIGIN must be one exact origin such as https://example.com",
    );
  }
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("PACKET_CLIENT_ORIGIN must use https outside local mode");
  }
  if (environment === "development") {
    if (value !== DEVELOPMENT_CLIENT_ORIGIN) {
      throw new Error(
        `PACKET_CLIENT_ORIGIN must be ${DEVELOPMENT_CLIENT_ORIGIN} in development`,
      );
    }
    return value;
  }
  const hostname = url.hostname;
  if (
    value === DEVELOPMENT_CLIENT_ORIGIN ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.includes("-dev.") ||
    hostname.startsWith("dev.") ||
    /^[\d.]+$/.test(hostname) ||
    hostname.startsWith("[")
  ) {
    throw new Error("PACKET_CLIENT_ORIGIN is not a production client origin");
  }
  return value;
}

function parseMaxRooms(value: string | undefined): number {
  if (value === undefined) return DEFAULT_MAX_ROOMS;
  const maxRooms = Number(value);
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(maxRooms) ||
    maxRooms < 1 ||
    maxRooms > MAX_ROOMS_CEILING
  ) {
    throw new Error(
      `PACKET_MAX_ROOMS must be an integer from 1 to ${MAX_ROOMS_CEILING}`,
    );
  }
  return maxRooms;
}

export function parseConfig(env: NodeJS.ProcessEnv): ServerConfig {
  const environment = env.PACKET_ENV;
  if (!environment || !environments.has(environment as Environment)) {
    throw new Error("PACKET_ENV must be local, development, or production");
  }
  const region = env.PACKET_REGION;
  if (!region || !/^[a-z][a-z0-9-]{0,31}$/.test(region)) {
    throw new Error("PACKET_REGION must be a lowercase region identifier");
  }
  if (environment === "local" ? region !== "local" : region === "local") {
    throw new Error("PACKET_REGION does not match PACKET_ENV");
  }
  const host = env.PACKET_HOST;
  if (!host || (environment === "local" && host !== "127.0.0.1")) {
    throw new Error("PACKET_HOST is required; local mode must bind 127.0.0.1");
  }
  const port = Number(env.PACKET_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PACKET_PORT must be an integer from 1 to 65535");
  }
  const checkedEnvironment = environment as Environment;
  return {
    environment: checkedEnvironment,
    region,
    host,
    port,
    clientOrigin: parseClientOrigin(
      checkedEnvironment,
      env.PACKET_CLIENT_ORIGIN,
    ),
    maxRooms: parseMaxRooms(env.PACKET_MAX_ROOMS),
  };
}
