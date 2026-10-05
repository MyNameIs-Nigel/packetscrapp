/** Accepted D1 deposit values. These are tuning hypotheses, not balance evidence. */
export const DEPOSIT_CONFIG = Object.freeze({
  revision: "d1-deposits-mulberry32-r1",
  interiorMin: 2,
  interiorMax: 21,
  blasterRange: 8,
  smallScrap: 10,
  largeScrap: 40,
  ownedBands: [
    { kind: "small", count: 2, min: 3, max: 4 },
    { kind: "small", count: 4, min: 5, max: 7 },
    { kind: "small", count: 2, min: 8, max: 10 },
    { kind: "large", count: 1, min: 5, max: 7 },
    { kind: "large", count: 1, min: 8, max: 10 },
  ] as const,
  unownedSmall: 12,
  unownedLarge: 4,
  maxAttempts: 16,
});
