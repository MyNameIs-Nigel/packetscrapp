export const PROTOCOL_VERSION = 1;

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
export const systemRandom: RandomSource = { next: () => Math.random() };
