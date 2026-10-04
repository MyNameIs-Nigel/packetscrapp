import { createServer, type Server as HttpServer } from "node:http";
import {
  createEndpoint,
  createRouter,
  defineRoom,
  defineServer,
} from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { PROTOCOL_VERSION } from "@packetscrapp/shared";
import { FoundationRoom } from "./foundation-room.ts";
import type { ServerConfig } from "./config.ts";

declare const __BUILD_SHA__: string;
declare const __BUILD_ENV__: string;

const buildSha =
  typeof __BUILD_SHA__ === "undefined" ? "local-uncommitted" : __BUILD_SHA__;
const buildEnvironment =
  typeof __BUILD_ENV__ === "undefined" ? "local" : __BUILD_ENV__;

export interface RunningServer {
  port: number;
  close(): Promise<void>;
}

export async function startServer(
  config: ServerConfig,
): Promise<RunningServer> {
  if (buildEnvironment !== config.environment) {
    throw new Error(
      `Artifact environment ${buildEnvironment} does not match ${config.environment}`,
    );
  }
  const httpServer: HttpServer = createServer();
  const gameServer = defineServer({
    transport: new WebSocketTransport({ server: httpServer }),
    gracefullyShutdown: false,
    rooms: { foundation: defineRoom(FoundationRoom) },
    routes: createRouter({
      health: createEndpoint("/health", { method: "GET" }, (context) => {
        context.setHeader("Cache-Control", "no-store");
        if (config.environment === "local") {
          context.setHeader(
            "Access-Control-Allow-Origin",
            "http://127.0.0.1:5173",
          );
        }
        return Promise.resolve({
          environment: config.environment,
          region: config.region,
          protocolVersion: PROTOCOL_VERSION,
          sha: buildSha,
        });
      }),
    }),
  });
  await gameServer.listen(config.port, config.host);
  const address = httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP address after server startup");
  }
  return {
    port: address.port,
    close: async () => {
      await gameServer.gracefullyShutdown(false);
    },
  };
}
