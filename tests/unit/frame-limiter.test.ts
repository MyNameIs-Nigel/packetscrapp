import { describe, expect, it } from "vitest";
import {
  FrameWindowLimiter,
  type FrameDecision,
} from "../../shared/src/index.ts";
import { ManualClock } from "../fixtures/clock.ts";

function burst(limiter: FrameWindowLimiter, count: number): FrameDecision[] {
  return Array.from({ length: count }, () => limiter.onFrame());
}

describe("per-connection tumbling frame window", () => {
  it("accepts exactly 30 frames and drops the 31st", () => {
    const limiter = new FrameWindowLimiter(new ManualClock());
    const decisions = burst(limiter, 31);
    expect(decisions.slice(0, 30)).toEqual(Array(30).fill("accept"));
    expect(decisions[30]).toBe("drop");
  });

  it("resets exactly at the window boundary", () => {
    const clock = new ManualClock();
    const limiter = new FrameWindowLimiter(clock);
    burst(limiter, 31);
    clock.advance(999);
    expect(limiter.onFrame()).toBe("drop");
    clock.advance(1);
    expect(
      burst(limiter, 31).filter((decision) => decision === "accept"),
    ).toHaveLength(30);
  });

  it("anchors the first window at construction, not at the first frame", () => {
    const clock = new ManualClock();
    clock.advance(5000);
    const limiter = new FrameWindowLimiter(clock);
    clock.advance(900);
    burst(limiter, 30);
    clock.advance(99);
    expect(limiter.onFrame()).toBe("drop");
    clock.advance(1);
    expect(limiter.onFrame()).toBe("accept");
  });

  it("drops 31 to 60 frames without disconnecting", () => {
    const limiter = new FrameWindowLimiter(new ManualClock());
    const decisions = burst(limiter, 60);
    expect(decisions).not.toContain("disconnect");
    expect(decisions.filter((decision) => decision === "drop")).toHaveLength(
      30,
    );
  });

  it("does not disconnect for a single flooded window", () => {
    const limiter = new FrameWindowLimiter(new ManualClock());
    expect(burst(limiter, 500)).not.toContain("disconnect");
  });

  it("disconnects on the 61st frame of the second consecutive flooded window", () => {
    const clock = new ManualClock();
    const limiter = new FrameWindowLimiter(clock);
    expect(burst(limiter, 61)).not.toContain("disconnect");
    clock.advance(1000);
    const second = burst(limiter, 61);
    expect(second.slice(0, 60)).not.toContain("disconnect");
    expect(second[60]).toBe("disconnect");
  });

  it("does not disconnect when the second window stays at 60 frames", () => {
    const clock = new ManualClock();
    const limiter = new FrameWindowLimiter(clock);
    burst(limiter, 61);
    clock.advance(1000);
    expect(burst(limiter, 60)).not.toContain("disconnect");
  });

  it("forgives a quiet window between two flooded ones", () => {
    const clock = new ManualClock();
    const limiter = new FrameWindowLimiter(clock);
    burst(limiter, 61);
    clock.advance(2000);
    expect(burst(limiter, 61)).not.toContain("disconnect");
    clock.advance(1000);
    expect(burst(limiter, 61)).toContain("disconnect");
  });

  it("tracks independent connections separately", () => {
    const clock = new ManualClock();
    const noisy = new FrameWindowLimiter(clock);
    const quiet = new FrameWindowLimiter(clock);
    burst(noisy, 100);
    expect(quiet.onFrame()).toBe("accept");
  });
});
