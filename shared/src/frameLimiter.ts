import type { Clock } from "./index.ts";
import {
  FLOOD_FRAMES_PER_WINDOW,
  FLOOD_WINDOWS_TO_DISCONNECT,
  FRAME_WINDOW_MS,
  MAX_ACTIONS_PER_WINDOW,
} from "./protocol.ts";

export type FrameDecision = "accept" | "drop" | "disconnect";

export interface FrameLimits {
  windowMs: number;
  maxAccepted: number;
  floodThreshold: number;
  floodWindows: number;
}

export const DEFAULT_FRAME_LIMITS: FrameLimits = {
  windowMs: FRAME_WINDOW_MS,
  maxAccepted: MAX_ACTIONS_PER_WINDOW,
  floodThreshold: FLOOD_FRAMES_PER_WINDOW,
  floodWindows: FLOOD_WINDOWS_TO_DISCONNECT,
};

/**
 * Per-connection fixed (tumbling) window counter on an injected monotonic
 * clock. The first window opens when the limiter is created, which is when the
 * connection is accepted; window `k` covers `[anchor + k*windowMs, anchor +
 * (k+1)*windowMs)`. Every frame is counted, including unknown and malformed
 * ones. At most `maxAccepted` frames per window are accepted and the rest are
 * dropped. A window with more than `floodThreshold` frames is a flood window;
 * the connection is disconnected on the frame that makes the
 * `floodWindows`-th consecutive window flooded.
 */
export class FrameWindowLimiter {
  private readonly clock: Clock;
  private readonly limits: FrameLimits;
  private readonly anchor: number;
  private window = 0;
  private count = 0;
  private consecutiveFlood = 0;
  private lastFloodWindow = -2;

  constructor(clock: Clock, limits: FrameLimits = DEFAULT_FRAME_LIMITS) {
    this.clock = clock;
    this.limits = limits;
    this.anchor = clock.now();
  }

  onFrame(): FrameDecision {
    const elapsed = Math.max(0, this.clock.now() - this.anchor);
    const window = Math.floor(elapsed / this.limits.windowMs);
    if (window !== this.window) {
      this.window = window;
      this.count = 0;
    }
    this.count += 1;
    if (this.count === this.limits.floodThreshold + 1) {
      this.consecutiveFlood =
        this.lastFloodWindow === window - 1 ? this.consecutiveFlood + 1 : 1;
      this.lastFloodWindow = window;
      if (this.consecutiveFlood >= this.limits.floodWindows) {
        return "disconnect";
      }
    }
    return this.count <= this.limits.maxAccepted ? "accept" : "drop";
  }
}
