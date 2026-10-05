import { describe, expect, it } from "vitest";
import {
  JOIN_ERROR_CODES,
  JOIN_ERROR_MESSAGES,
  PROTOCOL_VERSION,
  joinRejectionFromMessage,
  parseFixtureOptions,
  parseJoinOptions,
  sanitizeNickname,
} from "../../shared/src/index.ts";

describe("nickname sanitizer", () => {
  it("accepts one to sixteen code points and trims", () => {
    expect(sanitizeNickname("  Alex  ")).toEqual({ ok: true, name: "Alex" });
    expect(sanitizeNickname("a")).toEqual({ ok: true, name: "a" });
    const sixteen = "abcdefghijklmnop";
    expect(sanitizeNickname(sixteen)).toEqual({ ok: true, name: sixteen });
  });

  it("rejects 17 code points instead of truncating", () => {
    expect(sanitizeNickname("abcdefghijklmnopq")).toEqual({
      ok: false,
      reason: "name_too_long",
    });
  });

  it("counts code points, not UTF-16 units", () => {
    // Sixteen astral characters are 32 UTF-16 units but 16 code points.
    expect(sanitizeNickname("😀".repeat(16))).toEqual({
      ok: true,
      name: "😀".repeat(16),
    });
    expect(sanitizeNickname("😀".repeat(17))).toEqual({
      ok: false,
      reason: "name_too_long",
    });
  });

  it.each(["", "   ", "\u0000\u001f\u007f\u009f", "\t\n\r", "  "])(
    "rejects empty, whitespace-only and control-only input %j",
    (raw) => {
      expect(sanitizeNickname(raw)).toEqual({
        ok: false,
        reason: "name_empty",
      });
    },
  );

  it("strips C0 and C1 controls without inserting spaces", () => {
    expect(sanitizeNickname("A\u0000l\u001fe\u007fx\u009f")).toEqual({
      ok: true,
      name: "Alex",
    });
    // Controls are removed before the length check, so they cannot cause rejection.
    expect(sanitizeNickname(`${"\u0001".repeat(40)}Bo`)).toEqual({
      ok: true,
      name: "Bo",
    });
  });

  it("normalizes to NFC", () => {
    const decomposed = "Café";
    const result = sanitizeNickname(decomposed);
    expect(result).toEqual({ ok: true, name: "Café" });
    expect([...(result.ok ? result.name : "")]).toHaveLength(4);
  });

  it("keeps markup as literal text", () => {
    expect(sanitizeNickname("<b>x</b>")).toEqual({
      ok: true,
      name: "<b>x</b>",
    });
  });

  it("rejects absurd raw input before processing", () => {
    expect(sanitizeNickname("a".repeat(100_000))).toEqual({
      ok: false,
      reason: "name_too_long",
    });
  });
});

describe("join options", () => {
  const valid = {
    name: "Alex",
    protocol: PROTOCOL_VERSION,
    environment: "local",
  };

  it("admits a valid request and keeps only the sanitized name", () => {
    expect(parseJoinOptions(valid, "local")).toEqual({
      ok: true,
      join: { name: "Alex" },
    });
  });

  it("never reads a supplied identity or seat", () => {
    const result = parseJoinOptions(
      { ...valid, sessionId: "evil", seat: 4, seatId: 4, id: "x" },
      "local",
    );
    expect(result).toEqual({ ok: true, join: { name: "Alex" } });
  });

  it.each([
    [null, "malformed"],
    ["Alex", "malformed"],
    [[], "malformed"],
    [{}, "malformed"],
    [{ ...valid, name: 4 }, "malformed"],
    [{ ...valid, protocol: "2" }, "malformed"],
    [{ ...valid, environment: undefined }, "malformed"],
    [{ ...valid, protocol: PROTOCOL_VERSION - 1 }, "protocol"],
    [{ ...valid, protocol: PROTOCOL_VERSION + 1 }, "protocol"],
    [{ ...valid, environment: "production" }, "environment"],
    [{ ...valid, name: "   " }, "name_empty"],
    [{ ...valid, name: "x".repeat(17) }, "name_too_long"],
  ])("rejects %j as %s", (options, reason) => {
    expect(parseJoinOptions(options, "local")).toEqual({ ok: false, reason });
  });

  it("checks version and environment before the name", () => {
    expect(
      parseJoinOptions({ ...valid, protocol: 1, name: "   " }, "local"),
    ).toEqual({ ok: false, reason: "protocol" });
  });

  it("ignores a forged __proto__ key", () => {
    const forged: unknown = JSON.parse(
      '{"name":"Alex","protocol":2,"environment":"local","__proto__":{"name":"x"}}',
    );
    expect(parseJoinOptions(forged, "local")).toEqual({
      ok: true,
      join: { name: "Alex" },
    });
  });

  it("uses real HTTP statuses and a distinct message for every refusal", () => {
    const messages = Object.values(JOIN_ERROR_MESSAGES);
    expect(new Set(messages).size).toBe(messages.length);
    for (const [reason, status] of Object.entries(JOIN_ERROR_CODES)) {
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
      expect(
        joinRejectionFromMessage(
          JOIN_ERROR_MESSAGES[reason as keyof typeof JOIN_ERROR_MESSAGES],
        ),
      ).toBe(reason);
    }
    expect(joinRejectionFromMessage("something else")).toBeUndefined();
  });
});

describe("fixture options", () => {
  it("accepts exact prototype options", () => {
    expect(parseFixtureOptions({ seats: 3, seed: 42, view: "build" })).toEqual({
      seats: 3,
      seed: 42,
      view: "build",
    });
  });

  it.each([
    undefined,
    {},
    { seats: 1, seed: 1, view: "build" },
    { seats: 6, seed: 1, view: "build" },
    { seats: 2.5, seed: 1, view: "build" },
    { seats: 2, seed: -1, view: "build" },
    { seats: 2, seed: 2 ** 32, view: "build" },
    { seats: 2, seed: 1.5, view: "build" },
    { seats: 2, seed: 1, view: "debug" },
  ])("rejects %j", (options) => {
    expect(parseFixtureOptions(options)).toBeNull();
  });
});
