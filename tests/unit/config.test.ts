import { describe, expect, it } from "vitest";
import { parseConfig } from "../../server/src/config.ts";

const valid = {
  PACKET_ENV: "local",
  PACKET_REGION: "local",
  PACKET_HOST: "127.0.0.1",
  PACKET_PORT: "2567",
};

describe("server configuration", () => {
  it("accepts explicit local settings", () => {
    expect(parseConfig(valid)).toEqual({
      environment: "local",
      region: "local",
      host: "127.0.0.1",
      port: 2567,
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
