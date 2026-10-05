import { describe, expect, it } from "vitest";
import {
  createSeededRandom,
  isMovementTick,
  layoutFor,
  stepMovement,
  type Blocker,
  type Direction,
  type MoveIntent,
  type MovementShip,
  type MovementWorld,
  type PlayerCount,
} from "../../shared/src/index.ts";

function world(
  count: PlayerCount,
  options: { beltActive?: boolean; blockers?: Blocker[] } = {},
): MovementWorld {
  return {
    layout: layoutFor(count),
    beltActive: options.beltActive ?? false,
    blockers: options.blockers ?? [],
  };
}

function ship(
  seat: number,
  x: number,
  y: number,
  intent: MoveIntent,
  facing: Direction = "right",
  alive = true,
): MovementShip {
  return { seat, x, y, facing, alive, intent };
}

function run(
  w: MovementWorld,
  ships: MovementShip[],
  ticks: number,
  startTick = 1,
): MovementShip[] {
  let current = ships;
  for (let tick = startTick; tick < startTick + ticks; tick += 1) {
    current = stepMovement(w, current, tick).ships;
  }
  return current;
}

describe("movement ticks", () => {
  it.each([
    [0, false],
    [1, false],
    [2, true],
    [3, false],
    [4, true],
    [-2, false],
    [2.5, false],
  ])("tick %s is a movement tick: %s", (tick, expected) => {
    expect(isMovementTick(tick)).toBe(expected);
  });

  it("moves one tile on tick 2 and not on odd ticks (M01)", () => {
    const w = world(2);
    let ships = [ship(0, 13, 11, "right")];
    const positions: number[] = [];
    for (let tick = 1; tick <= 6; tick += 1) {
      ships = stepMovement(w, ships, tick).ships;
      positions.push(ships[0]?.x ?? -1);
    }
    expect(positions).toEqual([13, 14, 14, 15, 15, 16]);
    expect(ships[0]?.facing).toBe("right");
  });

  it("persists a held intent and stops when it becomes none", () => {
    const w = world(2);
    let ships = run(w, [ship(0, 13, 11, "down", "right")], 4);
    expect(ships[0]).toMatchObject({
      x: 13,
      y: 13,
      facing: "down",
      intent: "down",
    });
    ships = run(w, [{ ...(ships[0] as MovementShip), intent: "none" }], 4, 5);
    expect(ships[0]).toMatchObject({ x: 13, y: 13, facing: "down" });
  });

  it("does not mutate its input", () => {
    const w = world(2);
    const input = [ship(0, 13, 11, "right")];
    const snapshot = JSON.parse(JSON.stringify(input)) as unknown;
    stepMovement(w, input, 2);
    expect(input).toEqual(snapshot);
  });
});

describe("world edge, facing and stop (M02)", () => {
  it("rejects a step beyond the world and keeps position, facing and intent", () => {
    const w = world(2);
    const result = stepMovement(w, [ship(0, 0, 8, "left", "left")], 2);
    expect(result.ships[0]).toMatchObject({
      x: 0,
      y: 8,
      facing: "left",
      intent: "left",
    });
    expect(result.events).toEqual([
      {
        seat: 0,
        outcome: "outside_world",
        from: { x: 0, y: 8 },
        to: { x: -1, y: 8 },
      },
    ]);
  });

  it("changes facing when the next step succeeds (D1 example 2)", () => {
    const w = world(2);
    const blocked = stepMovement(w, [ship(0, 0, 8, "left", "left")], 2).ships;
    const moved = stepMovement(
      w,
      [{ ...(blocked[0] as MovementShip), intent: "down" }],
      4,
    );
    expect(moved.ships[0]).toMatchObject({ x: 0, y: 9, facing: "down" });
  });

  it.each([
    [{ x: 47, y: 5 }, "right"],
    [{ x: 5, y: 0 }, "up"],
    [{ x: 5, y: 23 }, "down"],
  ] as const)(
    "rejects leaving the 2-player world from %j going %s",
    (cell, direction) => {
      const result = stepMovement(
        world(2),
        [ship(0, cell.x, cell.y, direction, "left")],
        2,
      );
      expect(result.ships[0]).toMatchObject({ ...cell, facing: "left" });
    },
  );
});

describe("ship collisions (M02)", () => {
  it("fails a swap for both ships", () => {
    const result = stepMovement(
      world(2),
      [ship(0, 5, 5, "right"), ship(1, 6, 5, "left", "left")],
      2,
    );
    expect(result.ships.map(({ x, y }) => [x, y])).toEqual([
      [5, 5],
      [6, 5],
    ]);
    expect(result.events.map((event) => event.outcome)).toEqual([
      "blocked_ship",
      "blocked_ship",
    ]);
  });

  it("fails two ships aiming at one empty tile", () => {
    const result = stepMovement(
      world(2),
      [ship(0, 5, 5, "right"), ship(1, 7, 5, "left", "left")],
      2,
    );
    expect(result.ships.map(({ x, y }) => [x, y])).toEqual([
      [5, 5],
      [7, 5],
    ]);
    expect(result.events.map((event) => event.outcome)).toEqual([
      "contested",
      "contested",
    ]);
  });

  it("fails three ships aiming at one tile", () => {
    const result = stepMovement(
      world(3),
      [ship(0, 5, 5, "right"), ship(1, 7, 5, "left"), ship(2, 6, 4, "down")],
      2,
    );
    expect(result.ships.map(({ x, y }) => [x, y])).toEqual([
      [5, 5],
      [7, 5],
      [6, 4],
    ]);
  });

  it("uses start-of-tick positions: a follower cannot enter a tile its leader leaves", () => {
    const result = stepMovement(
      world(2),
      [ship(0, 5, 5, "right"), ship(1, 6, 5, "right")],
      2,
    );
    expect(result.ships.map(({ x }) => x)).toEqual([5, 7]);
    expect(result.events.find((event) => event.seat === 0)?.outcome).toBe(
      "blocked_ship",
    );
  });

  it("blocks a step into a stationary ship, such as another ship's starting tile", () => {
    const result = stepMovement(
      world(2),
      [ship(0, 33, 11, "right"), ship(1, 34, 11, "none", "left")],
      2,
    );
    expect(result.ships[0]).toMatchObject({ x: 33, y: 11, facing: "right" });
  });

  it("lets a different seat's ship move on unaffected by a rejected neighbor", () => {
    const result = stepMovement(
      world(2),
      [ship(0, 0, 8, "left", "left"), ship(1, 10, 10, "down", "left")],
      2,
    );
    expect(result.ships[1]).toMatchObject({ x: 10, y: 11, facing: "down" });
  });
});

describe("static blockers (M02)", () => {
  const cell = { x: 6, y: 5 };
  it.each(["core", "deposit", "turret"] as const)(
    "a %s blocks entry",
    (kind) => {
      const result = stepMovement(
        world(2, { blockers: [{ ...cell, kind }] }),
        [ship(0, 5, 5, "right", "up")],
        2,
      );
      expect(result.ships[0]).toMatchObject({
        x: 5,
        y: 5,
        facing: "up",
        intent: "right",
      });
      expect(result.events[0]?.outcome).toBe("blocked_static");
    },
  );

  it("blocks an enemy wall but passes the owner", () => {
    const blockers: Blocker[] = [{ ...cell, kind: "wall", owner: 1 }];
    const enemy = stepMovement(
      world(2, { blockers }),
      [ship(0, 5, 5, "right")],
      2,
    );
    expect(enemy.ships[0]).toMatchObject({ x: 5 });
    const owner = stepMovement(
      world(2, { blockers }),
      [ship(1, 5, 5, "right")],
      2,
    );
    expect(owner.ships[0]).toMatchObject({ x: 6 });
  });

  it("does not let a dead ship or an idle intent occupy or move", () => {
    const w = world(2);
    const result = stepMovement(
      w,
      [
        ship(0, 5, 5, "right"),
        ship(1, 6, 5, "none", "left", false),
        ship(2, 9, 9, "none"),
      ],
      2,
    );
    expect(result.ships[0]).toMatchObject({ x: 6 });
    expect(result.ships[1]).toMatchObject({ x: 6, alive: false });
    expect(result.ships[2]).toMatchObject({ x: 9, y: 9 });
  });
});

describe("build-phase Belt classification (M02)", () => {
  it("makes the (22, 11) to (23, 11) step succeed, lethal, and update facing", () => {
    const w = world(2, { beltActive: true });
    const result = stepMovement(w, [ship(0, 22, 11, "right", "up")], 2);
    expect(result.ships[0]).toMatchObject({
      x: 23,
      y: 11,
      facing: "right",
      alive: false,
      intent: "none",
    });
    expect(result.events).toEqual([
      {
        seat: 0,
        outcome: "belt_death",
        from: { x: 22, y: 11 },
        to: { x: 23, y: 11 },
      },
    ]);
  });

  it("never reaches (24, 11) during build", () => {
    const w = world(2, { beltActive: true });
    const ships = run(w, [ship(0, 21, 11, "right")], 12);
    expect(ships[0]).toMatchObject({ x: 23, alive: false });
  });

  it("is lethal at an intersection and on horizontal bands in larger maps", () => {
    const w = world(4, { beltActive: true });
    expect(stepMovement(w, [ship(0, 5, 22, "down")], 2).ships[0]).toMatchObject(
      {
        y: 23,
        alive: false,
      },
    );
    expect(
      stepMovement(w, [ship(0, 23, 22, "down", "right", true)], 2).ships[0],
    ).toMatchObject({
      alive: false,
    });
  });

  it("is harmless once the Belt is gone (battle view)", () => {
    const w = world(2, { beltActive: false });
    const ships = run(w, [ship(0, 21, 11, "right")], 12);
    expect(ships[0]).toMatchObject({ x: 27, alive: true });
  });
});

describe("movement invariants", () => {
  it.each([2, 3, 4, 5] as const)(
    "keeps %i random ships legal over many ticks",
    (count) => {
      const layout = layoutFor(count);
      const random = createSeededRandom(1234 + count);
      const directions: MoveIntent[] = ["up", "down", "left", "right", "none"];
      const blockers: Blocker[] = layout.slots.map((slot) => ({
        ...slot.core,
        kind: "core",
      }));
      const w: MovementWorld = { layout, beltActive: false, blockers };
      let ships: MovementShip[] = layout.slots
        .slice(0, count)
        .map((slot, seat) => ({
          seat,
          x: slot.spawn.x,
          y: slot.spawn.y,
          facing: slot.spawnFacing,
          alive: true,
          intent: "none",
        }));
      for (let tick = 1; tick <= 600; tick += 1) {
        ships = ships.map((current) => ({
          ...current,
          intent:
            directions[Math.floor(random.next() * directions.length)] ?? "none",
        }));
        ships = stepMovement(w, ships, tick).ships;
        const seen = new Set<string>();
        for (const current of ships) {
          expect(current.x).toBeGreaterThanOrEqual(0);
          expect(current.y).toBeGreaterThanOrEqual(0);
          expect(current.x).toBeLessThan(layout.width);
          expect(current.y).toBeLessThan(layout.height);
          expect(
            blockers.some((b) => b.x === current.x && b.y === current.y),
          ).toBe(false);
          const key = `${current.x},${current.y}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
      }
    },
  );
});
