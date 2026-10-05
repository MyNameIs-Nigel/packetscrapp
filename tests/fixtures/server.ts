import { Client, Protocol, type Room } from "@colyseus/sdk";
import {
  PROTOCOL_VERSION,
  type WelcomeMessage,
} from "../../shared/src/index.ts";
import type { ServerConfig } from "../../server/src/config.ts";
import {
  startServer,
  type RunningServer,
  type ServerOptions,
} from "../../server/src/server.ts";

export const LOCAL_ORIGIN = "http://127.0.0.1:5173";

export const LOCAL_CONFIG: ServerConfig = {
  environment: "local",
  region: "local",
  host: "127.0.0.1",
  port: 0,
  clientOrigin: LOCAL_ORIGIN,
  maxRooms: 20,
};

export interface TestServer {
  server: RunningServer;
  endpoint: string;
  /** Private structured events, one JSON line each. */
  logs: string[];
  /** Everything written to stdout/stderr while the server ran. */
  close(): Promise<void>;
}

export async function startTestServer(
  overrides: Partial<ServerConfig> = {},
  options: ServerOptions = {},
): Promise<TestServer> {
  const logs: string[] = [];
  const server = await startServer(
    { ...LOCAL_CONFIG, ...overrides },
    { logSink: (line) => logs.push(line), ...options },
  );
  return {
    server,
    endpoint: `http://127.0.0.1:${server.port}`,
    logs,
    close: () => server.close(),
  };
}

/** A real SDK client that sends the accepted browser origin, as the built client's page would. */
export function sdkClient(
  endpoint: string,
  origin: string | undefined = LOCAL_ORIGIN,
): Client {
  return new Client(endpoint, origin ? { headers: { Origin: origin } } : {});
}

export function joinOptions(
  name: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return { name, protocol: PROTOCOL_VERSION, environment: "local", ...extra };
}

export interface Seated {
  room: Room;
  seat: number;
}

/** Join and wait for the server's private `welcome`, which carries the admitted seat. */
export async function seat(
  client: Client,
  roomName: string,
  options: Record<string, unknown>,
  roomId?: string,
  beforeWelcome?: (room: Room) => void,
): Promise<Seated> {
  const room = roomId
    ? await client.joinById(roomId, options)
    : await client.joinOrCreate(roomName, options);
  // The SDK resolves on JOIN_ROOM, before the first state message. Attach raw
  // capture synchronously here, before awaiting welcome (which can follow state).
  beforeWelcome?.(room);
  const message = await new Promise<WelcomeMessage>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("No welcome message")),
      2000,
    );
    room.onMessage("welcome", (welcome: WelcomeMessage) => {
      clearTimeout(timer);
      resolve(welcome);
    });
  });
  return { room, seat: message.seat };
}

export async function waitFor(
  predicate: () => boolean,
  description = "condition",
  timeoutMs = 3000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline)
      throw new Error(`Timed out waiting for ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

export interface ShipView {
  seat: number;
  x: number;
  y: number;
  facing: string;
  alive: boolean;
}

export interface EntityView {
  id: string;
  kind: string;
  x: number;
  y: number;
  slot: number;
}

export interface PlayerView {
  seat: number;
  name: string;
  bot: boolean;
  coreAlive: boolean;
  /** `undefined` when the server did not send the hidden field to this client. */
  slot: number | undefined;
}

interface MapLike<T> {
  forEach(callback: (value: T) => void): void;
  size: number;
}

function collect<T>(map: MapLike<T> | undefined): T[] {
  const values: T[] = [];
  map?.forEach((value) => values.push(value));
  return values;
}

/** What this client has actually received and decoded, never what it drew. */
export function receivedState(room: Room): {
  phase: string;
  prototype: boolean;
  playerCount: number;
  tick: number;
  players: PlayerView[];
  ships: ShipView[];
  entities: EntityView[];
} {
  const state = room.state as {
    phase: string;
    prototype: boolean;
    playerCount: number;
    tick: number;
    players?: MapLike<PlayerView>;
    ships?: MapLike<ShipView>;
    entities?: MapLike<EntityView>;
  };
  return {
    phase: state.phase,
    prototype: state.prototype,
    // Unsent default values arrive as `undefined`; the server starts both at 0.
    playerCount: state.playerCount ?? 0,
    tick: state.tick ?? 0,
    players: collect(state.players)
      .map((player) => ({
        seat: player.seat,
        name: player.name,
        bot: player.bot,
        coreAlive: player.coreAlive,
        slot: player.slot,
      }))
      .sort((a, b) => a.seat - b.seat),
    ships: collect(state.ships)
      .map((ship) => ({
        seat: ship.seat,
        x: ship.x,
        y: ship.y,
        facing: ship.facing,
        alive: ship.alive,
      }))
      .sort((a, b) => a.seat - b.seat),
    entities: collect(state.entities)
      .map((entity) => ({
        id: entity.id,
        kind: entity.kind,
        x: entity.x,
        y: entity.y,
        slot: entity.slot,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/** Capture every raw frame this client receives, to inspect the serialized bytes themselves. */
export function recordFrames(room: Room): {
  text(): string;
  count(): number;
  initialStateCount(): number;
} {
  const frames: Buffer[] = [];
  const transport = room.connection.transport as unknown as {
    ws: {
      addEventListener(
        event: "message",
        listener: (event: { data: unknown }) => void,
      ): void;
    };
  };
  transport.ws.addEventListener("message", (event) => {
    const { data } = event;
    if (data instanceof ArrayBuffer) frames.push(Buffer.from(data));
    else if (ArrayBuffer.isView(data)) {
      frames.push(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    }
  });
  return {
    text: () => Buffer.concat(frames).toString("latin1"),
    count: () => frames.length,
    initialStateCount: () =>
      frames.filter((frame) => frame[0] === Protocol.ROOM_STATE).length,
  };
}

export interface PrototypeSeats {
  seated: Seated[];
  roomId: string;
}

/** Create a local movement prototype room and seat `count` independent SDK clients in join order. */
export async function startPrototype(
  endpoint: string,
  count: number,
  seed: number,
  view: "build" | "battle",
  record?: (room: Room, index: number) => void,
): Promise<PrototypeSeats> {
  const options = { seats: count, seed, view };
  const seated: Seated[] = [];
  let roomId: string | undefined;
  for (let index = 0; index < count; index += 1) {
    const entry = await seat(
      sdkClient(endpoint),
      "prototype",
      joinOptions(`Pilot${index}`, options),
      roomId,
      (room) => record?.(room, index),
    );
    roomId = entry.room.roomId;
    seated.push(entry);
  }
  return { seated, roomId: roomId ?? "" };
}
