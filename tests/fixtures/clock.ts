import type { Clock } from "../../shared/src/index.ts";

/** Advance boundary tests without sleeping or changing the process clock. */
export class ManualClock implements Clock {
  private time = 0;

  now(): number {
    return this.time;
  }

  advance(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      throw new Error("Clock advance must be finite and non-negative");
    }
    this.time += milliseconds;
  }
}
