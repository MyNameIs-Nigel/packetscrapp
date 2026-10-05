import {
  TICK_INTERVAL_MS,
  type Clock,
  monotonicClock,
} from "@packetscrapp/shared";
import type { ServerConfig } from "./config.ts";
import type { Logger } from "./logger.ts";

/** Operational counters the health endpoint and tests read. Nothing here is a secret or a payload. */
export interface Counters {
  /** Rooms currently alive, including a room waiting for its first seat to be consumed. */
  rooms: number;
  /** Seats currently held across all rooms. */
  players: number;
  joinsRejected: number;
  originRejected: number;
  peerCapRejected: number;
  capacityRejected: number;
  framesDropped: number;
  framesRejected: number;
  framesOversized: number;
  floodDisconnects: number;
  inputsRejected: number;
  inputsAccepted: number;
}

export function createCounters(): Counters {
  return {
    rooms: 0,
    players: 0,
    joinsRejected: 0,
    originRejected: 0,
    peerCapRejected: 0,
    capacityRejected: 0,
    framesDropped: 0,
    framesRejected: 0,
    framesOversized: 0,
    floodDisconnects: 0,
    inputsRejected: 0,
    inputsAccepted: 0,
  };
}

/** Drives a room's simulation. Real time in production; manually stepped in tests. */
export interface TickDriver {
  /** Register a step callback; returns a function that unregisters it. */
  register(step: () => void): () => void;
}

/** Ticks catch up at most this many steps per poll so a stalled loop cannot spiral. */
const MAX_CATCH_UP_TICKS = 4;
const POLL_INTERVAL_MS = 10;

/**
 * Real-time driver: a fixed 15 Hz tick count derived from the injected
 * monotonic clock, polled finely so the average rate holds even though a
 * timer cannot fire at 66.67 ms exactly.
 */
export function createRealtimeTicks(clock: Clock = monotonicClock): TickDriver {
  return {
    register(step) {
      const start = clock.now();
      let done = 0;
      const timer = setInterval(() => {
        const due = Math.floor((clock.now() - start) / TICK_INTERVAL_MS) - done;
        const steps = Math.min(due, MAX_CATCH_UP_TICKS);
        if (due > steps) done += due - steps;
        for (let index = 0; index < steps; index += 1) {
          done += 1;
          step();
        }
      }, POLL_INTERVAL_MS);
      timer.unref();
      return () => clearInterval(timer);
    },
  };
}

export interface ManualTicks extends TickDriver {
  /** Run `count` simulation ticks on every registered room. */
  advance(count: number): void;
}

export function createManualTicks(): ManualTicks {
  const steps = new Set<() => void>();
  return {
    register(step) {
      steps.add(step);
      return () => {
        steps.delete(step);
      };
    },
    advance(count) {
      for (let index = 0; index < count; index += 1) {
        for (const step of [...steps]) step();
      }
    },
  };
}

/** Everything a room needs from its server, injected so tests can control time and observe effects. */
export interface ServerRuntime {
  config: ServerConfig;
  /** Full build SHA, reported as `version`. */
  version: string;
  clock: Clock;
  logger: Logger;
  counters: Counters;
  ticks: TickDriver;
  /** Local movement prototype rooms exist only in the `local` environment. */
  prototypeEnabled: boolean;
  /** How long a matchmade seat is held for a client that has not connected yet. */
  seatReservationSeconds: number;
}
