/** Accepted D1 deposit values. These are tuning hypotheses, not balance evidence. */
export const DEPOSIT_CONFIG = Object.freeze({
  revision: "d1-deposits-mulberry32-r1",
  interiorMin: 2,
  interiorMax: 21,
  blasterRange: 8,
  smallScrap: 10,
  largeScrap: 40,
  ownedSmall: 8,
  ownedLarge: 2,
  unownedSmall: 12,
  unownedLarge: 4,
  maxAttempts: 16,
});
