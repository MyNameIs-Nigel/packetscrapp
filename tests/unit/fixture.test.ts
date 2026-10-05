import { describe, expect, it } from "vitest";
import {
  assignSectorSlots,
  createFixtureWorld,
  entityVisibleToSlot,
  layoutFor,
} from "../../shared/src/index.ts";

describe("prototype fixture world", () => {
  it("replays the handoff worked example: five players, seed 42", () => {
    const world = createFixtureWorld([10, 11, 12, 13, 14], 42, "build");
    expect(world.unownedSlot).toBe(4);
    expect(world.seatSlots).toEqual([1, 0, 5, 3, 2]);
    expect(world.ships.map((ship) => ship.seat)).toEqual([10, 11, 12, 13, 14]);
  });

  it("replays three players, seed 42", () => {
    const world = createFixtureWorld([0, 1, 2], 42, "battle");
    expect(world.unownedSlot).toBe(2);
    expect(world.seatSlots).toEqual([0, 3, 1]);
  });

  it.each([0, 1, 42, 4294967295])(
    "matches assignSectorSlots for seed %s",
    (seed) => {
      for (const count of [2, 3, 4, 5] as const) {
        const seats = Array.from({ length: count }, (_, index) => index);
        const world = createFixtureWorld(seats, seed, "build");
        const assignment = assignSectorSlots(count, seed);
        expect(world.unownedSlot).toBe(assignment.unownedSlot);
        expect(world.seatSlots).toEqual(assignment.ownedSlots);
      }
    },
  );

  it("places each ship on its sector spawn facing out from its core", () => {
    const world = createFixtureWorld([0, 1], 7, "build");
    const layout = layoutFor(2);
    world.ships.forEach((ship, rank) => {
      const slot = layout.slots[world.seatSlots[rank] ?? -1];
      expect(slot).toBeDefined();
      expect(ship).toMatchObject({
        x: slot?.spawn.x,
        y: slot?.spawn.y,
        facing: slot?.spawnFacing,
        alive: true,
        intent: "none",
      });
    });
  });

  it("creates unique entity ids and one sentinel per sector", () => {
    for (const count of [2, 3, 4, 5] as const) {
      const world = createFixtureWorld(
        Array.from({ length: count }, (_, index) => index),
        99,
        "build",
      );
      const ids = world.entities.map((entity) => entity.id);
      expect(new Set(ids).size).toBe(ids.length);
      const slotCount = layoutFor(count).slots.length;
      expect(
        world.entities.filter((entity) => entity.kind === "deposit"),
      ).toHaveLength(slotCount);
      expect(
        world.entities.filter((entity) => entity.kind === "core"),
      ).toHaveLength(count);
      // The sentinel never sits on a core, spawn or another entity.
      const cells = world.entities.map((entity) => `${entity.x},${entity.y}`);
      expect(new Set(cells).size).toBe(cells.length);
      for (const ship of world.ships)
        expect(cells).not.toContain(`${ship.x},${ship.y}`);
    }
  });

  it("rejects an unsupported seat count", () => {
    expect(() => createFixtureWorld([0], 1, "build")).toThrow("2 to 5");
    expect(() => createFixtureWorld([0, 1, 2, 3, 4, 5], 1, "build")).toThrow(
      "2 to 5",
    );
  });
});

describe("build and battle visibility rule", () => {
  it("shows a seat only its own sector during build", () => {
    expect(entityVisibleToSlot("build", 2, 2)).toBe(true);
    expect(entityVisibleToSlot("build", 2, 3)).toBe(false);
    expect(entityVisibleToSlot("build", null, 3)).toBe(false);
  });

  it("shows everything in battle and nothing while waiting", () => {
    expect(entityVisibleToSlot("battle", 2, 5)).toBe(true);
    expect(entityVisibleToSlot("battle", null, 5)).toBe(true);
    expect(entityVisibleToSlot("waiting", 2, 2)).toBe(false);
  });
});
