import { StateView } from "@colyseus/schema";
import { ServerError, type Client } from "@colyseus/core";
import {
  BUILD_CONFIG,
  JOIN_ERROR_CODES,
  JOIN_ERROR_MESSAGES,
  MESSAGE_MOVE,
  createBuildWorld,
  departBuildSeat,
  maxHull,
  parseBuildAction,
  parseFixtureOptions,
  parseMovePayload,
  queueBuildAction,
  stepBuildWorld,
  type AdmittedJoin,
  type BuildWorld,
  type FixtureOptions,
} from "@packetscrapp/shared";
import { EntitySchema, ShipSchema } from "./schema.ts";
import type { ServerRuntime } from "./runtime.ts";
import { createMatchRoom, type SeatRecord } from "./rooms.ts";

/** Local-only first build loop; E1's fixed movement fixture remains unchanged. */
export function createBuildRoom(
  runtime: ServerRuntime,
  Base: ReturnType<typeof createMatchRoom>,
) {
  class BuildRoom extends Base {
    private options: FixtureOptions | undefined;
    private world: BuildWorld | undefined;
    private stopTicks: (() => void) | undefined;
    private readonly dropped = new Set<number>();

    static override onAuth(
      token: string,
      options: unknown,
    ): Promise<AdmittedJoin> {
      const parsed = parseFixtureOptions(options);
      if (!parsed || parsed.view !== "build")
        throw new ServerError(
          JOIN_ERROR_CODES.fixture,
          JOIN_ERROR_MESSAGES.fixture,
        );
      return Base.onAuth(token, options);
    }
    protected override beforeCreate(options: unknown): void {
      const parsed = parseFixtureOptions(options);
      if (!parsed || parsed.view !== "build")
        throw new ServerError(
          JOIN_ERROR_CODES.fixture,
          JOIN_ERROR_MESSAGES.fixture,
        );
      this.options = parsed;
      this.maxClients = parsed.seats;
    }
    protected override afterJoin(): void {
      this.state.buildPreview = true;
      const options = this.options;
      if (!options || this.world || this.seats.size !== options.seats) return;
      const ordered = [...this.seats.values()].sort(
        (a, b) => a.sequence - b.sequence,
      );
      this.world = createBuildWorld(
        ordered.map((s) => s.seat),
        options.seed,
      );
      this.sync();
      void this.lock();
      this.stopTicks = runtime.ticks.register(() => this.step());
    }
    // Colyseus invokes onLeave after onDrop when no reconnection reservation was made.
    // Keep the logical contender for its fixed deadline; E5 will add authenticated recovery.
    override onDrop(client: Client): void {
      const record = this.seats.get(client.sessionId);
      if (record) this.dropped.add(record.seat);
    }
    protected override afterLeave(record: SeatRecord): void {
      if (!this.world) return;
      departBuildSeat(
        this.world,
        record.seat,
        this.dropped.delete(record.seat),
      );
      // Retain public participant identity after actual socket removal.
      this.state.players.set(String(record.seat), this.savedPlayer(record));
      this.sync();
    }
    private savedPlayer(record: SeatRecord) {
      // The base removes the departing roster row; recreate it from server-owned values.
      return new PlayerSchema({
        seat: record.seat,
        name: record.name,
        bot: false,
        coreAlive: true,
        slot: 0,
      });
    }
    protected override stopSimulation(): void {
      this.stopTicks?.();
      this.stopTicks = undefined;
    }
    private step(): void {
      const world = this.world;
      if (!world) return;
      try {
        stepBuildWorld(world);
        this.sync();
        for (const feedback of world.feedback) {
          const client = this.clients.find(
            (c) => this.seats.get(c.sessionId)?.seat === feedback.seat,
          );
          client?.send("feedback", { text: feedback.text });
        }
        if (
          world.phase === "ended" &&
          world.age - world.endedAt >= BUILD_CONFIG.resultsTicks
        )
          void this.disconnect();
      } catch {
        runtime.logger.event("internal_error", { reason: "build_tick_failed" });
        this.stopSimulation();
        void this.disconnect();
      }
    }
    private sync(): void {
      const world = this.world;
      if (!world) return;
      this.state.phase = world.phase;
      this.state.tick = world.tick;
      this.state.playerCount = world.seats.length;
      this.state.revealed = world.revealed;
      this.state.result = world.result;
      for (const player of world.seats) {
        const row = this.state.players.get(String(player.seat));
        if (row)
          Object.assign(row, {
            slot: player.slot,
            role: player.role,
            connected: player.connected,
            scrap: player.scrap,
            hull: player.hull,
            maxHull: maxHull(player),
            blasterLevel: player.blasterLevel,
            hullLevel: player.hullLevel,
            respawnAt: player.respawnAt,
            coreAlive: world.entities.some(
              (e) => e.kind === "core" && e.owner === player.seat,
            ),
          });
        if (player.role === "permanently_eliminated")
          this.state.ships.delete(String(player.seat));
        else {
          let ship = this.state.ships.get(String(player.seat));
          if (!ship) {
            ship = new ShipSchema();
            this.state.ships.set(String(player.seat), ship);
          }
          Object.assign(ship, {
            seat: player.seat,
            x: player.x,
            y: player.y,
            facing: player.facing,
            alive: player.alive,
          });
        }
      }
      const ids = new Set(world.entities.map((e) => e.id));
      for (const id of this.state.entities.keys())
        if (!ids.has(id)) this.state.entities.delete(id);
      for (const entity of world.entities) {
        let row = this.state.entities.get(entity.id);
        if (!row) {
          row = new EntitySchema();
          this.state.entities.set(entity.id, row);
        }
        Object.assign(row, {
          id: entity.id,
          kind: entity.kind,
          x: entity.x,
          y: entity.y,
          slot: entity.slot,
          owner: entity.owner,
          hp: Math.max(0, entity.hp),
          scrap: entity.scrap,
        });
      }
      for (const client of this.clients) {
        const seat = this.seats.get(client.sessionId)?.seat;
        const player = world.seats.find((s) => s.seat === seat);
        if (!player) continue;
        const visible = (slot: number): boolean =>
          world.revealed ||
          (player.role !== "permanently_eliminated" && slot === player.slot);
        const view = client.view ?? new StateView();
        client.view = view;
        // Add/remove only changed membership; the schema tracks the actual outgoing view.
        this.state.players.forEach((p) => {
          if (visible(p.slot)) view.add(p);
          else view.remove(p);
        });
        this.state.ships.forEach((ship) => {
          const owner = world.seats.find((s) => s.seat === ship.seat);
          if (owner && visible(owner.slot)) view.add(ship);
          else view.remove(ship);
        });
        this.state.entities.forEach((e) => {
          if (visible(e.slot)) view.add(e);
          else view.remove(e);
        });
      }
    }
    protected override handleAction(
      client: Client,
      type: string | number,
      payload: unknown,
    ): void {
      const world = this.world,
        seat = this.seats.get(client.sessionId)?.seat;
      const player = world?.seats.find((s) => s.seat === seat);
      if (
        !world ||
        !player ||
        !player.alive ||
        !player.connected ||
        world.phase !== "build"
      )
        return this.rejectInput("build_not_active");
      if (type === MESSAGE_MOVE) {
        const intent = parseMovePayload(payload);
        if (intent === undefined) return this.rejectInput("invalid_payload");
        player.intent = intent;
      } else {
        const action = parseBuildAction(type, payload);
        if (!action || !queueBuildAction(world, player.seat, action))
          return this.rejectInput("invalid_build_action");
      }
      runtime.counters.inputsAccepted++;
    }
  }
  return BuildRoom;
}
import { PlayerSchema } from "./schema.ts";
