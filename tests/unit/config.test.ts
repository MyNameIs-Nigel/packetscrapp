import { describe, expect, it } from "vitest";
import { parseConfig } from "../../server/src/config.ts";

const valid = {
  PACKET_ENV: "local",
  PACKET_REGION: "local",
  PACKET_HOST: "127.0.0.1",
  PACKET_PORT: "2567",
};

const development = {
  PACKET_ENV: "development",
  PACKET_REGION: "atl",
  PACKET_HOST: "127.0.0.1",
  PACKET_PORT: "2567",
  PACKET_CLIENT_ORIGIN: "https://dev.packetscr.app",
};

const production = {
  PACKET_ENV: "production",
  PACKET_REGION: "nyc",
  PACKET_HOST: "127.0.0.1",
  PACKET_PORT: "2567",
  PACKET_CLIENT_ORIGIN: "https://packetscr.app",
};

describe("server configuration", () => {
  it("accepts explicit local settings", () => {
    expect(parseConfig(valid)).toEqual({
      environment: "local",
      region: "local",
      host: "127.0.0.1",
      port: 2567,
      clientOrigin: "http://127.0.0.1:5173",
      maxRooms: 20,
    });
  });

  it.each([
    [{ ...valid, PACKET_ENV: undefined }, "PACKET_ENV"],
    [{ ...valid, PACKET_REGION: "New York" }, "PACKET_REGION"],
    [{ ...valid, PACKET_REGION: "nyc" }, "PACKET_REGION"],
    [{ ...valid, PACKET_HOST: "0.0.0.0" }, "PACKET_HOST"],
    [{ ...valid, PACKET_PORT: "0" }, "PACKET_PORT"],
    [{ ...valid, PACKET_PORT: "65536" }, "PACKET_PORT"],
    [{ ...valid, PACKET_PORT: "abc" }, "PACKET_PORT"],
  ])("rejects invalid configuration", (env, message) => {
    expect(() => parseConfig(env)).toThrow(message);
  });
});

describe("client origin policy", () => {
  it("fixes the local origin and refuses any other", () => {
    expect(
      parseConfig({ ...valid, PACKET_CLIENT_ORIGIN: "http://127.0.0.1:5173" })
        .clientOrigin,
    ).toBe("http://127.0.0.1:5173");
    expect(() =>
      parseConfig({ ...valid, PACKET_CLIENT_ORIGIN: "https://packetscr.app" }),
    ).toThrow("PACKET_CLIENT_ORIGIN");
  });

  it("requires the exact development origin in development", () => {
    expect(parseConfig(development).clientOrigin).toBe(
      "https://dev.packetscr.app",
    );
    expect(() =>
      parseConfig({ ...development, PACKET_CLIENT_ORIGIN: undefined }),
    ).toThrow("PACKET_CLIENT_ORIGIN");
    for (const origin of [
      "http://dev.packetscr.app",
      "https://dev.packetscr.app/",
      "https://dev.packetscr.app:8443",
      "https://packetscr.app",
      "http://127.0.0.1:5173",
      "*",
    ]) {
      expect(() =>
        parseConfig({ ...development, PACKET_CLIENT_ORIGIN: origin }),
      ).toThrow("PACKET_CLIENT_ORIGIN");
    }
  });

  it("requires an https production origin and never a development or local one", () => {
    expect(parseConfig(production).clientOrigin).toBe("https://packetscr.app");
    expect(() =>
      parseConfig({ ...production, PACKET_CLIENT_ORIGIN: undefined }),
    ).toThrow("PACKET_CLIENT_ORIGIN");
    for (const origin of [
      "http://packetscr.app",
      "https://packetscr.app/path",
      "https://dev.packetscr.app",
      "https://atl-dev.packetscr.app",
      "https://localhost",
      "https://127.0.0.1",
      "https://[::1]",
      "packetscr.app",
      "null",
      "*",
    ]) {
      expect(() =>
        parseConfig({ ...production, PACKET_CLIENT_ORIGIN: origin }),
      ).toThrow("PACKET_CLIENT_ORIGIN");
    }
  });
});

describe("room limit", () => {
  it("defaults to 20 and accepts a positive integer", () => {
    expect(parseConfig(valid).maxRooms).toBe(20);
    expect(parseConfig({ ...valid, PACKET_MAX_ROOMS: "3" }).maxRooms).toBe(3);
  });

  it.each(["0", "-1", "1.5", "abc", "", "1001", "1e2", " 5"])(
    "rejects PACKET_MAX_ROOMS=%j",
    (value) => {
      expect(() => parseConfig({ ...valid, PACKET_MAX_ROOMS: value })).toThrow(
        "PACKET_MAX_ROOMS",
      );
    },
  );
});
