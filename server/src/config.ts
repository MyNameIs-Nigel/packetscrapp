export type Environment = "local" | "development" | "production";

export interface ServerConfig {
  environment: Environment;
  region: string;
  host: string;
  port: number;
}

const environments = new Set<Environment>([
  "local",
  "development",
  "production",
]);

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
  return { environment: environment as Environment, region, host, port };
}
