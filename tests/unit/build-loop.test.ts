import { describe, expect, it } from "vitest";
import {
  BUILD_CONFIG,
  createBuildWorld,
  departBuildSeat,
  parseBuildAction,
  placementReason,
  queueBuildAction,
  stepBuildWorld,
  type BuildWorld,
} from "../../shared/src/index.ts";

function advance(w: BuildWorld, ticks: number): void {
  for (let i = 0; i < ticks; i++) stepBuildWorld(w);
}
function first(w: BuildWorld) {
  const p = w.seats[0];
  if (!p) throw Error("seat");
  return p;
}
function fund(w: BuildWorld, amount: number): void {
  first(w).scrap = amount;
}

describe("authoritative harvest/build stages", () => {
  it.each([2, 3, 4, 5])(
    "creates a deterministic zero-balance %i-seat map",
    (n) => {
      const w = createBuildWorld(
        Array.from({ length: n }, (_, i) => i),
        42,
      );
      expect(w.seats.every((p) => p.scrap === 0 && p.hull === 100)).toBe(true);
      expect(
        w.entities
          .filter((e) => e.kind === "deposit")
          .reduce((sum, e) => sum + e.scrap, 0),
      ).toBe(
        ({ 2: 320, 3: 760, 4: 640, 5: 1080 } as Record<number, number>)[n],
      );
      expect(
        createBuildWorld(
          Array.from({ length: n }, (_, i) => i),
          42,
        ),
      ).toEqual(w);
    },
  );
  it("harvests once after three legal hits and cooldown-consuming misses", () => {
    const w = createBuildWorld([0, 1], 42),
      p = first(w);
    w.entities = w.entities.filter((e) => e.kind === "core");
    w.entities.push({
      id: "ore",
      kind: "deposit",
      x: p.x + 2,
      y: p.y,
      slot: p.slot,
      owner: -1,
      hp: 30,
      scrap: 10,
    });
    p.facing = "right";
    for (let i = 0; i < 11; i++) {
      queueBuildAction(w, p.seat, { type: "fire" });
      stepBuildWorld(w);
    }
    expect(p.scrap).toBe(10);
    expect(w.entities.some((e) => e.id === "ore")).toBe(false);
    expect(w.paid).toBe(10);
    queueBuildAction(w, p.seat, { type: "fire" });
    advance(w, 5);
    expect(p.scrap).toBe(10);
    queueBuildAction(w, p.seat, { type: "fire" });
    stepBuildWorld(w);
    expect(p.fireReady).toBe(w.tick + 5);
  });
  it("purchases before moving and before harvested income; one build then one upgrade", () => {
    const w = createBuildWorld([0, 1], 42),
      p = first(w);
    fund(w, 50);
    w.entities = w.entities.filter((e) => e.kind === "core");
    p.facing = "right";
    p.intent = "down";
    w.tick = 1;
    queueBuildAction(w, p.seat, { type: "build", kind: "wall" });
    queueBuildAction(w, p.seat, { type: "upgrade", kind: "blaster" });
    stepBuildWorld(w);
    const wall = w.entities.find((e) => e.kind === "wall");
    expect(wall).toMatchObject({ x: 14, y: 11 });
    expect(p.y).toBe(12);
    expect(p.scrap).toBe(40);
    expect(p.blasterLevel).toBe(0);
    queueBuildAction(w, p.seat, { type: "upgrade", kind: "hull" });
    p.hull = 40;
    stepBuildWorld(w);
    expect(p.hull).toBe(90);
    expect(p.hullLevel).toBe(1);
    expect(p.scrap).toBe(0);
  });
  it("uses the earliest valid purchase, rejects occupied/reserved/outside radius, and caps upgrades", () => {
    const w = createBuildWorld([0, 1], 42),
      p = first(w);
    fund(w, 1000);
    w.entities = w.entities.filter((e) => e.kind === "core");
    const core = w.map.seats[0]?.core;
    if (!core) throw Error("core");
    expect(placementReason(w, p, { x: core.x + 8, y: core.y })).toBeUndefined();
    expect(placementReason(w, p, { x: core.x + 9, y: core.y })).toContain(
      "Outside",
    );
    expect(placementReason(w, p, w.map.seats[0]!.spawn)).toContain("respawn");
    p.blasterLevel = 3;
    queueBuildAction(w, p.seat, { type: "upgrade", kind: "blaster" });
    queueBuildAction(w, p.seat, { type: "upgrade", kind: "hull" });
    stepBuildWorld(w);
    expect(p.hullLevel).toBe(1);
    expect(p.scrap).toBe(960);
    expect(p.blasterLevel).toBe(3);
    queueBuildAction(w, p.seat, { type: "build", kind: "wall" });
    queueBuildAction(w, p.seat, { type: "build", kind: "turret" });
    stepBuildWorld(w);
    expect(
      w.entities.filter((e) => e.kind === "wall" || e.kind === "turret"),
    ).toHaveLength(1);
  });
  it("drops scrap once on Belt death, preserves levels, and respawns at t+225", () => {
    const w = createBuildWorld([0, 1], 42),
      p = first(w);
    p.x = 22;
    p.y = 5;
    p.facing = "right";
    p.intent = "right";
    p.scrap = 40;
    p.hullLevel = 1;
    advance(w, 2);
    expect(p.role).toBe("awaiting_respawn");
    expect(p.respawnAt).toBe(227);
    expect(p.scrap).toBe(0);
    expect(
      w.entities
        .filter((e) => e.kind === "pickup")
        .reduce((sum, e) => sum + e.scrap, 0),
    ).toBe(40);
    advance(w, 224);
    expect(p.alive).toBe(false);
    stepBuildWorld(w);
    expect(p.alive).toBe(true);
    expect(p.hull).toBe(150);
    expect(p.intent).toBe("none");
  });
  it("retains a fixed disconnect expiry across respawn and abandons without another pickup", () => {
    const w = createBuildWorld([0, 1, 2], 42),
      p = first(w);
    p.scrap = 40;
    departBuildSeat(w, p.seat, true);
    expect(p.disconnectAt).toBe(300);
    p.role = "awaiting_respawn";
    p.alive = false;
    p.respawnAt = 225;
    advance(w, 225);
    expect(p.alive).toBe(true);
    expect(p.disconnectAt).toBe(300);
    advance(w, 75);
    expect(p.role).toBe("permanently_eliminated");
    expect(p.scrap).toBe(0);
    expect(w.abandoned).toBe(40);
    expect(w.entities.some((e) => e.kind === "pickup")).toBe(false);
  });
  it("retries a blocked reserved spawn without moving it or resetting its deadline", () => {
    const w = createBuildWorld([0, 1, 2], 42),
      p = first(w),
      other = w.seats[1]!;
    const spawn = w.map.seats[0]!.spawn;
    p.alive = false;
    p.role = "awaiting_respawn";
    p.respawnAt = 1;
    other.x = spawn.x;
    other.y = spawn.y;
    stepBuildWorld(w);
    expect(p.alive).toBe(false);
    expect(p.respawnAt).toBe(1);
    other.x++;
    stepBuildWorld(w);
    expect(p.alive).toBe(true);
    expect(p).toMatchObject(spawn);
  });
  it("uses build rules on tick 1800, then reveals and freezes the inspection preview", () => {
    const w = createBuildWorld([0, 1], 42),
      p = first(w);
    w.tick = 1799;
    p.x = 22;
    p.y = 5;
    p.intent = "right";
    stepBuildWorld(w);
    expect(p.alive).toBe(false);
    expect(w.phase).toBe("battle");
    expect(w.revealed).toBe(true);
    expect(w.tick).toBe(1800);
    expect(queueBuildAction(w, p.seat, { type: "fire" })).toBe(false);
    advance(w, 10);
    expect(w.tick).toBe(1800);
  });
  it("ends early on voluntary departure without revealing build entities or duplicating scrap", () => {
    const w = createBuildWorld([0, 1], 42);
    first(w).scrap = 40;
    departBuildSeat(w, 0, false);
    stepBuildWorld(w);
    expect(w.phase).toBe("ended");
    expect(w.revealed).toBe(false);
    expect(w.result).toBe("Winner: seat 1");
    expect(w.abandoned).toBe(40);
    expect(first(w).scrap).toBe(0);
  });
  it("bounds queued work and rejects forged/malformed action envelopes", () => {
    for (const payload of [
      null,
      {},
      { kind: "wall", seat: 1 },
      { kind: "bad" },
      ["wall"],
    ])
      expect(parseBuildAction("build", payload)).toBeUndefined();
    expect(parseBuildAction("fire", { scrap: 999 })).toBeUndefined();
    expect(parseBuildAction("fire", undefined)).toEqual({ type: "fire" });
    const w = createBuildWorld([0, 1], 42);
    for (let i = 0; i < BUILD_CONFIG.maxQueued; i++)
      expect(queueBuildAction(w, 0, { type: "build", kind: "wall" })).toBe(
        true,
      );
    expect(queueBuildAction(w, 0, { type: "build", kind: "turret" })).toBe(
      false,
    );
    expect(w.queues.get(0)).toHaveLength(30);
  });
});
