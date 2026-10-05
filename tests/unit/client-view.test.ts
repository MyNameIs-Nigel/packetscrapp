import { describe, expect, it } from "vitest";
import { MOVE_ANIMATION_MS, TileAnimator } from "../../client/src/animation.ts";
import { readRoomView } from "../../client/src/view.ts";
import { TICK_INTERVAL_MS } from "../../shared/src/index.ts";

function collection<T extends object>(...values: T[]) {
  return {
    forEach: (callback: (value: T) => void) => values.forEach(callback),
  };
}

describe("room view reader", () => {
  it("returns safe defaults for missing or hostile state", () => {
    for (const state of [undefined, null, 5, "x", [], {}]) {
      expect(readRoomView(state)).toEqual({
        phase: "waiting",
        prototype: false,
        playerCount: 0,
        tick: 0,
        players: [],
        ships: [],
        entities: [],
      });
    }
  });

  it("reads and orders only what was received, treating unsent hidden fields as absent", () => {
    const view = readRoomView({
      phase: "build",
      prototype: true,
      playerCount: 2,
      tick: 7,
      players: collection(
        { seat: 1, name: "B", bot: false, coreAlive: true },
        { seat: 0, name: "A", bot: false, coreAlive: true, slot: 3 },
      ),
      ships: collection({
        seat: 0,
        x: 14,
        y: 11,
        facing: "right",
        alive: true,
      }),
      entities: collection(
        { id: "deposit-3", kind: "deposit", x: 16, y: 11, slot: 3 },
        { id: "core-3", kind: "core", x: 12, y: 11, slot: 3 },
      ),
    });
    expect(view.players.map((player) => [player.seat, player.slot])).toEqual([
      [0, 3],
      [1, undefined],
    ]);
    expect(view.ships).toEqual([
      { seat: 0, x: 14, y: 11, facing: "right", alive: true },
    ]);
    expect(view.entities.map((entity) => entity.id)).toEqual([
      "core-3",
      "deposit-3",
    ]);
    expect(view.tick).toBe(7);
  });

  it("coerces wrong-typed fields instead of trusting them", () => {
    const view = readRoomView({
      phase: 4,
      tick: "9",
      ships: collection(
        { seat: "0", x: 1.5, y: null, facing: 3, alive: "yes" },
        "junk" as never,
      ),
    });
    expect(view.phase).toBe("waiting");
    expect(view.tick).toBe(0);
    expect(view.ships).toEqual([
      { seat: 0, x: 0, y: 0, facing: "right", alive: true },
    ]);
  });
});

describe("tile interpolation", () => {
  it("slides over exactly two ticks", () => {
    expect(MOVE_ANIMATION_MS).toBeCloseTo(2 * TICK_INTERVAL_MS, 6);
    const animator = new TileAnimator({ x: 5, y: 5 }, 0);
    animator.update({ x: 6, y: 5 }, 1000, true);
    expect(animator.position(1000)).toEqual({ x: 5, y: 5 });
    expect(animator.position(1000 + MOVE_ANIMATION_MS / 2).x).toBeCloseTo(
      5.5,
      6,
    );
    expect(animator.position(1000 + MOVE_ANIMATION_MS)).toEqual({ x: 6, y: 5 });
    expect(animator.position(1000 + 10 * MOVE_ANIMATION_MS)).toEqual({
      x: 6,
      y: 5,
    });
  });

  it("always reports the server's tile as the destination", () => {
    const animator = new TileAnimator({ x: 5, y: 5 }, 0);
    animator.update({ x: 5, y: 6 }, 10, true);
    expect(animator.tile).toEqual({ x: 5, y: 6 });
  });

  it("restarts from the drawn position when a new tile arrives mid-slide", () => {
    const animator = new TileAnimator({ x: 5, y: 5 }, 0);
    animator.update({ x: 6, y: 5 }, 0, true);
    animator.update({ x: 7, y: 5 }, MOVE_ANIMATION_MS / 2, true);
    expect(animator.position(MOVE_ANIMATION_MS / 2).x).toBeCloseTo(5.5, 6);
    expect(animator.position(MOVE_ANIMATION_MS * 1.5)).toEqual({ x: 7, y: 5 });
  });

  it("snaps for jumps and when smoothing is off", () => {
    const jump = new TileAnimator({ x: 5, y: 5 }, 0);
    jump.update({ x: 20, y: 5 }, 100, true);
    expect(jump.position(100)).toEqual({ x: 20, y: 5 });
    const still = new TileAnimator({ x: 5, y: 5 }, 0);
    still.update({ x: 6, y: 5 }, 100, false);
    expect(still.position(100)).toEqual({ x: 6, y: 5 });
  });

  it("ignores a repeated tile", () => {
    const animator = new TileAnimator({ x: 5, y: 5 }, 0);
    animator.update({ x: 6, y: 5 }, 100, true);
    animator.update({ x: 6, y: 5 }, 150, true);
    expect(animator.position(100 + MOVE_ANIMATION_MS)).toEqual({ x: 6, y: 5 });
  });
});
