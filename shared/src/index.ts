export {
  DEFAULT_FRAME_LIMITS,
  FrameWindowLimiter,
  type FrameDecision,
  type FrameLimits,
} from "./frameLimiter.ts";
export {
  createFixtureWorld,
  entityVisibleToSlot,
  type FixtureEntity,
  type FixtureWorld,
  type Phase,
} from "./fixture.ts";
export {
  JOIN_ERROR_CODES,
  JOIN_ERROR_MESSAGES,
  joinRejectionFromMessage,
  parseFixtureOptions,
  parseJoinOptions,
  type AdmittedJoin,
  type FixtureOptions,
  type JoinErrorReason,
  type JoinRejection,
  type JoinResult,
} from "./join.ts";
export {
  SECTOR_SIZE,
  beltCells,
  inWorld,
  isBeltCell,
  isPlayerCount,
  layoutFor,
  slotAt,
  stepFor,
  type Cell,
  type Layout,
  type SlotGeometry,
} from "./layout.ts";
export {
  isMovementTick,
  stepMovement,
  type Blocker,
  type BlockerKind,
  type MoveEvent,
  type MoveOutcome,
  type MovementResult,
  type MovementShip,
  type MovementWorld,
} from "./movement.ts";
export {
  sanitizeNickname,
  type NameRejection,
  type NameResult,
} from "./names.ts";
export * from "./protocol.ts";
export { createSeededRandom } from "./random.ts";
export { assignSectorSlots, fisherYatesShuffle } from "./sectorAssignment.ts";
export type { PlayerCount, SectorAssignment } from "./sectorAssignment.ts";

export interface Clock {
  now(): number;
}

export interface RandomSource {
  next(): number;
}

export const systemClock: Clock = { now: () => Date.now() };
/** Monotonic milliseconds for windows and tick scheduling; never wall-clock time. */
export const monotonicClock: Clock = { now: () => performance.now() };
export const systemRandom: RandomSource = { next: () => Math.random() };
