import { Room, ServerError, type Client } from "@colyseus/core";
import { StateView } from "@colyseus/schema";
import {
  JOIN_ERROR_CODES,
  JOIN_ERROR_MESSAGES,
  MAX_SEATS,
  MESSAGE_MOVE,
  MESSAGE_WELCOME,
  PROTOCOL_VERSION,
  TICK_INTERVAL_MS,
  createFixtureWorld,
  entityVisibleToSlot,
  parseFixtureOptions,
  parseJoinOptions,
  parseMovePayload,
  stepMovement,
  type AdmittedJoin,
  type Blocker,
  type FixtureOptions,
  type FixtureWorld,
  type JoinErrorReason,
  type MovementShip,
  type Phase,
  type WelcomeMessage,
} from "@packetscrapp/shared";
import {
  EntitySchema,
  PlayerSchema,
  RoomStateSchema,
  ShipSchema,
  type RoomState,
} from "./schema.ts";
import type { ServerRuntime } from "./runtime.ts";

interface SeatRecord {
  /** Server-issued seat index, the lowest free one at admission. */
  seat: number;
  /** Monotonic join counter. Sorting by it gives the replay join order. */
  sequence: number;
  name: string;
}

function refuse(runtime: ServerRuntime, reason: JoinErrorReason): never {
  runtime.counters.joinsRejected += 1;
  runtime.logger.event("join_rejected", { reason });
  throw new ServerError(JOIN_ERROR_CODES[reason], JOIN_ERROR_MESSAGES[reason]);
}

function admittedJoin(auth: unknown): AdmittedJoin | undefined {
  if (typeof auth !== "object" || auth === null) return undefined;
  const name: unknown = (auth as Record<string, unknown>).name;
  return typeof name === "string" ? { name } : undefined;
}

type RoomClient = Client;

/**
 * Create the ordinary waiting-room class bound to one server runtime. The
 * room admits up to five seats, issues identity itself, shows a roster only,
 * and is disposed when the last client leaves. It has no actions: every
 * client message is dropped and counted.
 */
export function createMatchRoom(runtime: ServerRuntime) {
  class MatchRoom extends Room<{ state: RoomState }> {
    override maxClients = MAX_SEATS;
    protected readonly seats = new Map<string, SeatRecord>();
    private joinSequence = 0;
    private counted = false;

    /**
     * Runs during matchmaking, before any room is created or seat reserved.
     * Version, environment and nickname are validated here, and the returned
     * value (the sanitized name) is the only client input the server keeps.
     */
    static override onAuth(
      _token: string,
      options: unknown,
    ): Promise<AdmittedJoin> {
      const result = parseJoinOptions(options, runtime.config.environment);
      if (!result.ok) refuse(runtime, result.reason);
      return Promise.resolve(result.join);
    }

    override onCreate(options: unknown): void {
      // Subclasses refuse bad creation options before the room is counted.
      this.beforeCreate?.(options);
      if (runtime.counters.rooms >= runtime.config.maxRooms) {
        runtime.counters.capacityRejected += 1;
        runtime.logger.event("capacity_rejected", {
          rooms: runtime.counters.rooms,
        });
        throw new ServerError(
          JOIN_ERROR_CODES.capacity,
          JOIN_ERROR_MESSAGES.capacity,
        );
      }
      runtime.counters.rooms += 1;
      this.counted = true;
      this.patchRate = TICK_INTERVAL_MS;
      this.seatReservationTimeout = runtime.seatReservationSeconds;
      const state = new RoomStateSchema();
      state.phase = "waiting";
      state.prototype = this.prototype;
      this.setState(state);
      this.onMessage("*", (client, type, message) => {
        if (this.handleAction) this.handleAction(client, type, message);
        else this.rejectInput("no_actions_while_waiting");
      });
      runtime.logger.event("room_created", { rooms: runtime.counters.rooms });
    }

    override onJoin(
      client: RoomClient,
      _options: unknown,
      auth: unknown,
    ): void {
      const join = admittedJoin(auth);
      if (!join) {
        throw new ServerError(
          JOIN_ERROR_CODES.malformed,
          JOIN_ERROR_MESSAGES.malformed,
        );
      }
      const used = new Set(
        [...this.seats.values()].map((record) => record.seat),
      );
      let seat = 0;
      while (used.has(seat)) seat += 1;
      if (seat >= MAX_SEATS) {
        throw new ServerError(
          JOIN_ERROR_CODES.capacity,
          JOIN_ERROR_MESSAGES.capacity,
        );
      }
      this.joinSequence += 1;
      this.seats.set(client.sessionId, {
        seat,
        sequence: this.joinSequence,
        name: join.name,
      });
      client.view = new StateView();
      this.state.players.set(
        String(seat),
        new PlayerSchema({
          seat,
          name: join.name,
          bot: false,
          coreAlive: true,
          slot: 0,
        }),
      );
      runtime.counters.players += 1;
      runtime.logger.event("player_joined", {
        seat,
        players: runtime.counters.players,
      });
      const welcome: WelcomeMessage = { seat, protocol: PROTOCOL_VERSION };
      client.send(MESSAGE_WELCOME, welcome);
      this.afterJoin?.();
    }

    override onLeave(client: RoomClient): void {
      const record = this.seats.get(client.sessionId);
      if (!record) return;
      this.seats.delete(client.sessionId);
      this.state.players.delete(String(record.seat));
      client.view?.dispose();
      runtime.counters.players -= 1;
      runtime.logger.event("player_left", {
        seat: record.seat,
        players: runtime.counters.players,
      });
      this.afterLeave?.(record);
    }

    override onDispose(): void {
      this.stopSimulation?.();
      if (this.counted) {
        this.counted = false;
        runtime.counters.rooms -= 1;
        runtime.logger.event("room_disposed", {
          rooms: runtime.counters.rooms,
        });
      }
    }

    /** True only for the labelled local movement prototype. */
    protected readonly prototype: boolean = false;

    // Optional hooks: the waiting room implements none of them.
    protected beforeCreate?(options: unknown): void;
    protected afterJoin?(): void;
    protected afterLeave?(record: SeatRecord): void;
    protected stopSimulation?(): void;
    /** Without a handler every client message is dropped and counted: the waiting room has no actions. */
    protected handleAction?(
      client: RoomClient,
      type: string | number,
      message: unknown,
    ): void;

    protected rejectInput(reason: string): void {
      runtime.counters.inputsRejected += 1;
      runtime.logger.event("input_rejected", { reason });
    }
  }
  return MatchRoom;
}

type MatchRoomClass = ReturnType<typeof createMatchRoom>;

/** Server-held simulation for one prototype room. */
interface Fixture {
  world: FixtureWorld;
  tick: number;
  ships: MovementShip[];
  blockers: Blocker[];
  beltActive: boolean;
  phase: Phase;
  /** Seat index -> sector slot, from the replayable assignment. */
  slotBySeat: Map<number, number>;
}

/**
 * The labelled local movement prototype (E1.2). It exists only when the server
 * runs in the `local` environment. Once the requested number of seats has
 * joined, it starts a fixture world in either the build view (own sector only,
 * Belt up) or the battle view (everything, Belt down) and advances it at
 * 15 Hz. It shows server-owned movement only: no scrap, combat, respawn or
 * match lifecycle.
 */
export function createPrototypeRoom(
  runtime: ServerRuntime,
  Base: MatchRoomClass,
) {
  class PrototypeRoom extends Base {
    private options: FixtureOptions | undefined;
    private fixture: Fixture | undefined;
    private stopTicks: (() => void) | undefined;

    static override onAuth(
      token: string,
      options: unknown,
    ): Promise<AdmittedJoin> {
      if (parseFixtureOptions(options) === null) refuse(runtime, "fixture");
      return Base.onAuth(token, options);
    }

    protected override readonly prototype: boolean = true;

    protected override beforeCreate(options: unknown): void {
      const parsed = parseFixtureOptions(options);
      if (!parsed) refuse(runtime, "fixture");
      this.options = parsed;
      this.maxClients = parsed.seats;
    }

    protected override afterJoin(): void {
      const options = this.options;
      if (options && !this.fixture && this.seats.size === options.seats) {
        this.startFixture(options);
      }
    }

    protected override afterLeave(record: SeatRecord): void {
      const ship = this.fixture?.ships.find(
        (candidate) => candidate.seat === record.seat,
      );
      // A departed seat's ship stays where it is, idle. Reconnect and removal rules belong to E5.
      if (ship) ship.intent = "none";
    }

    protected override stopSimulation(): void {
      this.stopTicks?.();
      this.stopTicks = undefined;
    }

    private startFixture(options: FixtureOptions): void {
      const ordered = [...this.seats.values()].sort(
        (left, right) => left.sequence - right.sequence,
      );
      const world = createFixtureWorld(
        ordered.map((record) => record.seat),
        options.seed,
        options.view,
      );
      const slotBySeat = new Map<number, number>();
      ordered.forEach((record, rank) => {
        slotBySeat.set(record.seat, world.seatSlots[rank] ?? 0);
      });
      const blockers: Blocker[] = world.entities.map((entity) => ({
        x: entity.x,
        y: entity.y,
        kind: entity.kind,
      }));
      this.fixture = {
        world,
        tick: 0,
        ships: world.ships.map((ship) => ({ ...ship })),
        blockers,
        beltActive: options.view === "build",
        phase: options.view,
        slotBySeat,
      };
      this.state.phase = options.view;
      this.state.playerCount = world.seats.length;
      for (const ship of world.ships) {
        this.state.ships.set(
          String(ship.seat),
          new ShipSchema({
            seat: ship.seat,
            x: ship.x,
            y: ship.y,
            facing: ship.facing,
            alive: ship.alive,
          }),
        );
      }
      for (const entity of world.entities) {
        this.state.entities.set(
          entity.id,
          new EntitySchema({
            id: entity.id,
            kind: entity.kind,
            x: entity.x,
            y: entity.y,
            slot: entity.slot,
          }),
        );
      }
      for (const [seat, slot] of slotBySeat) {
        const player = this.state.players.get(String(seat));
        if (player) player.slot = slot;
      }
      this.refreshViews();
      // The fixture is a fixed set of seats: later arrivals cannot join mid-run.
      void this.lock();
      this.stopTicks = runtime.ticks.register(() => this.step());
    }

    /** Give every client exactly what the current phase allows it to receive. */
    private refreshViews(): void {
      const fixture = this.fixture;
      if (!fixture) return;
      for (const client of this.clients) {
        const record = this.seats.get(client.sessionId);
        const view = client.view;
        if (!record || !view) continue;
        const ownSlot = fixture.slotBySeat.get(record.seat) ?? null;
        const visible = (slot: number | undefined): boolean =>
          slot !== undefined &&
          entityVisibleToSlot(fixture.phase, ownSlot, slot);
        this.state.players.forEach((player, key) => {
          const slot = fixture.slotBySeat.get(Number(key));
          if (visible(slot)) view.add(player);
        });
        this.state.ships.forEach((ship, key) => {
          if (visible(fixture.slotBySeat.get(Number(key)))) view.add(ship);
        });
        this.state.entities.forEach((entity) => {
          if (visible(entity.slot)) view.add(entity);
        });
      }
    }

    /** Local-test hook: drop the build-phase Belt and reveal every sector. */
    reveal(): boolean {
      const fixture = this.fixture;
      if (!fixture || fixture.phase === "battle") return false;
      fixture.phase = "battle";
      fixture.beltActive = false;
      this.state.phase = "battle";
      this.refreshViews();
      return true;
    }

    private step(): void {
      const fixture = this.fixture;
      if (!fixture) return;
      try {
        fixture.tick += 1;
        const result = stepMovement(
          {
            layout: fixture.world.layout,
            beltActive: fixture.beltActive,
            blockers: fixture.blockers,
          },
          fixture.ships,
          fixture.tick,
        );
        fixture.ships = result.ships;
        this.state.tick = fixture.tick;
        for (const ship of fixture.ships) {
          const synced = this.state.ships.get(String(ship.seat));
          if (!synced) continue;
          synced.x = ship.x;
          synced.y = ship.y;
          synced.facing = ship.facing;
          synced.alive = ship.alive;
        }
      } catch {
        // Fail closed: a rule error must stop this room, never the process.
        runtime.logger.event("internal_error", { reason: "tick_failed" });
        this.stopSimulation();
        void this.disconnect();
      }
    }

    protected override handleAction(
      client: RoomClient,
      type: string | number,
      message: unknown,
    ): void {
      if (type !== MESSAGE_MOVE) return this.rejectInput("unknown_type");
      const fixture = this.fixture;
      const record = this.seats.get(client.sessionId);
      if (!fixture || !record) return this.rejectInput("not_started");
      const intent = parseMovePayload(message);
      if (intent === undefined) return this.rejectInput("invalid_payload");
      const ship = fixture.ships.find(
        (candidate) => candidate.seat === record.seat,
      );
      if (!ship?.alive) return this.rejectInput("ship_not_alive");
      // One intent per seat, latest validated receipt wins; nothing is queued.
      ship.intent = intent;
      runtime.counters.inputsAccepted += 1;
    }
  }
  return PrototypeRoom;
}
