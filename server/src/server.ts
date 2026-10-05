import { createServer, type Server as HttpServer } from "node:http";
import {
  createEndpoint,
  createRouter,
  defineRoom,
  defineServer,
  matchMaker,
  type RegisteredHandler,
} from "@colyseus/core";
import {
  MAX_FRAME_BYTES,
  PROTOCOL_VERSION,
  ROOM_MATCH,
  ROOM_PROTOTYPE,
  monotonicClock,
  type Clock,
  type HealthDocument,
} from "@packetscrapp/shared";
import {
  PeerConnectionTracker,
  createUpgradeVerifier,
  installHttpGate,
} from "./admission.ts";
import type { ServerConfig } from "./config.ts";
import { attachFrameGate } from "./frame-gate.ts";
import { createLogger, silentSink, type LogSink } from "./logger.ts";
import {
  createCounters,
  createManualTicks,
  createRealtimeTicks,
  type Counters,
  type ManualTicks,
  type ServerRuntime,
} from "./runtime.ts";
import { createMatchRoom, createPrototypeRoom } from "./rooms.ts";
import { GatedWebSocketTransport } from "./transport.ts";

declare const __BUILD_SHA__: string;
declare const __BUILD_ENV__: string;

const buildSha =
  typeof __BUILD_SHA__ === "undefined" ? "local-uncommitted" : __BUILD_SHA__;
const buildEnvironment =
  typeof __BUILD_ENV__ === "undefined" ? "local" : __BUILD_ENV__;

/**
 * Programmatic options. None is reachable from the network or the process
 * environment: `main.ts` passes only the log sink, and tests use the rest to
 * control time and observe effects.
 */
export interface ServerOptions {
  /** Monotonic clock for frame windows, uptime and tick scheduling. */
  clock?: Clock;
  /** `"manual"` replaces the 15 Hz timer with `advanceTicks`. */
  ticks?: "realtime" | "manual";
  /** Receives private structured events as JSON lines. Silent by default. */
  logSink?: LogSink;
  /** Seconds an unclaimed seat reservation is held (default 15). */
  seatReservationSeconds?: number;
}

export interface RunningServer {
  port: number;
  /** Live counters; read-only for callers. */
  counters: Readonly<Counters>;
  /** Run simulation ticks in every room. Only available with `ticks: "manual"`. */
  advanceTicks(count: number): void;
  /** Local prototype only: drop the Belt and reveal every sector in a room. */
  revealBattle(roomId: string): boolean;
  close(): Promise<void>;
}

interface RevealableRoom {
  reveal(): boolean;
}

function isRevealable(value: unknown): value is RevealableRoom {
  return (
    typeof value === "object" &&
    value !== null &&
    "reveal" in value &&
    typeof value.reveal === "function"
  );
}

/**
 * Room types a server registers. The movement prototype and its fixtures are
 * never registered outside the `local` environment, so a development or
 * production server cannot be asked to create one.
 */
export function roomDefinitions(
  runtime: ServerRuntime,
): Record<string, RegisteredHandler> {
  const MatchRoom = createMatchRoom(runtime);
  const rooms: Record<string, RegisteredHandler> = {
    [ROOM_MATCH]: defineRoom(MatchRoom),
  };
  if (runtime.prototypeEnabled) {
    rooms[ROOM_PROTOTYPE] = defineRoom(
      createPrototypeRoom(runtime, MatchRoom),
    ).filterBy(["seats", "seed", "view"]);
  }
  return rooms;
}

export async function startServer(
  config: ServerConfig,
  options: ServerOptions = {},
): Promise<RunningServer> {
  if (buildEnvironment !== config.environment) {
    throw new Error(
      `Artifact environment ${buildEnvironment} does not match ${config.environment}`,
    );
  }
  const clock = options.clock ?? monotonicClock;
  const manualTicks: ManualTicks | undefined =
    options.ticks === "manual" ? createManualTicks() : undefined;
  const counters = createCounters();
  const startedAt = clock.now();
  const runtime: ServerRuntime = {
    config,
    version: buildSha,
    clock,
    logger: createLogger(
      {
        environment: config.environment,
        region: config.region,
        version: buildSha,
      },
      options.logSink ?? silentSink,
    ),
    counters,
    ticks: manualTicks ?? createRealtimeTicks(clock),
    prototypeEnabled: config.environment === "local",
    seatReservationSeconds: options.seatReservationSeconds ?? 15,
  };

  const rooms = roomDefinitions(runtime);

  const httpServer: HttpServer = createServer();
  const tracker = new PeerConnectionTracker();
  const transport = new GatedWebSocketTransport(
    {
      server: httpServer,
      maxPayload: MAX_FRAME_BYTES,
      verifyClient: createUpgradeVerifier(runtime, tracker),
    },
    (socket, request) => attachFrameGate(socket, request, runtime),
  );

  const gameServer = defineServer({
    transport,
    gracefullyShutdown: false,
    // Stdout carries only private structured events, never a banner.
    greet: false,
    rooms,
    routes: createRouter({
      health: createEndpoint("/health", { method: "GET" }, (context) => {
        context.setHeader("Cache-Control", "no-store");
        const health: HealthDocument = {
          status: "ok",
          region: config.region,
          version: buildSha,
          environment: config.environment,
          protocol: PROTOCOL_VERSION,
          uptimeSeconds: Math.max(
            0,
            Math.floor((clock.now() - startedAt) / 1000),
          ),
          rooms: counters.rooms,
          players: counters.players,
          maxRooms: config.maxRooms,
          accepting: counters.rooms < config.maxRooms,
        };
        return Promise.resolve(health);
      }),
    }),
  });
  await new Promise<void>((resolve, reject) => {
    gameServer
      .listen(config.port, config.host, undefined, () => {
        // Routes are bound by now; put the origin and CORS policy in front of them.
        installHttpGate(httpServer, runtime);
        resolve();
      })
      .catch(reject);
  });
  const address = httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP address after server startup");
  }
  runtime.logger.event("server_started", { rooms: counters.rooms });
  return {
    port: address.port,
    counters,
    advanceTicks: (count) => {
      if (!manualTicks) {
        throw new Error("advanceTicks requires ticks: manual");
      }
      manualTicks.advance(count);
    },
    revealBattle: (roomId) => {
      const room: unknown = matchMaker.getLocalRoomById(roomId);
      return isRevealable(room) ? room.reveal() : false;
    },
    close: async () => {
      await gameServer.gracefullyShutdown(false);
      runtime.logger.event("server_stopped");
    },
  };
}
