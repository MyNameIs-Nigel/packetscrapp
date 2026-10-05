import type {
  IncomingMessage,
  Server as HttpServer,
  ServerResponse,
} from "node:http";
import {
  JOIN_ERROR_CODES,
  JOIN_ERROR_MESSAGES,
  MAX_JOIN_BODY_BYTES,
  MAX_PEER_CONNECTIONS,
} from "@packetscrapp/shared";
import type { ServerRuntime } from "./runtime.ts";

/**
 * Exact-origin policy. A request is admitted only when its `Origin` header is
 * byte-for-byte the configured client origin. A missing, `null`, duplicated or
 * different origin is refused. Non-browser clients can forge the header, so
 * this stops other websites from using these servers, not custom clients;
 * every message is still validated.
 */
export function isAdmittedOrigin(
  origin: string | undefined,
  clientOrigin: string,
): boolean {
  return origin === clientOrigin;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value.join(", ") : value;
}

/** Counts live WebSocket connections per actual transport peer (never a forwarded header). */
export class PeerConnectionTracker {
  private readonly counts = new Map<string, number>();
  private readonly limit: number;

  constructor(limit: number = MAX_PEER_CONNECTIONS) {
    this.limit = limit;
  }

  /** Reserve a slot for `peer`. Returns a release function, or `null` at the limit. */
  acquire(peer: string): (() => void) | null {
    const current = this.counts.get(peer) ?? 0;
    if (current >= this.limit) return null;
    this.counts.set(peer, current + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const remaining = (this.counts.get(peer) ?? 1) - 1;
      if (remaining <= 0) this.counts.delete(peer);
      else this.counts.set(peer, remaining);
    };
  }

  get peers(): number {
    return this.counts.size;
  }
}

export type VerifyCallback = (
  allowed: boolean,
  status?: number,
  message?: string,
) => void;

export interface UpgradeInfo {
  origin: string;
  secure: boolean;
  req: IncomingMessage;
}

/**
 * `verifyClient` for the WebSocket server: exact Origin first, then the
 * per-peer connection cap counted on the TCP peer address.
 */
export function createUpgradeVerifier(
  runtime: ServerRuntime,
  tracker: PeerConnectionTracker,
): (info: UpgradeInfo, callback: VerifyCallback) => void {
  return (info, callback) => {
    const origin = headerValue(info.req.headers.origin);
    if (!isAdmittedOrigin(origin, runtime.config.clientOrigin)) {
      runtime.counters.originRejected += 1;
      runtime.logger.event("origin_rejected", { transport: "websocket" });
      callback(false, 403, "Forbidden");
      return;
    }
    const peer = info.req.socket.remoteAddress ?? "unknown";
    const release = tracker.acquire(peer);
    if (!release) {
      runtime.counters.peerCapRejected += 1;
      runtime.logger.event("peer_cap_rejected", { transport: "websocket" });
      callback(false, 429, "Too Many Connections");
      return;
    }
    info.req.socket.once("close", release);
    callback(true);
  };
}

const CORS_HEADER = /^access-control-/i;

function sendJson(
  response: ServerResponse,
  status: number,
  body: Record<string, unknown>,
): void {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(text).toString(),
    "cache-control": "no-store",
  });
  response.end(text);
}

/**
 * Put one policy in front of every HTTP route the game server serves:
 *
 * - CORS is the configured client origin only (never `*`, never reflected),
 *   and Colyseus's own permissive CORS headers are suppressed.
 * - Matchmaking (`/matchmake/*`) requires the exact client Origin and a small
 *   declared body, so a refused request never reaches `onAuth` or allocates a
 *   room or seat.
 * - `/health` stays readable by probes that send no Origin.
 *
 * The wrapper replaces the existing `request` listeners, so call it after the
 * routes have been bound (inside the listen callback).
 */
export function installHttpGate(
  server: HttpServer,
  runtime: ServerRuntime,
): void {
  const downstream = server.listeners("request") as ((
    request: IncomingMessage,
    response: ServerResponse,
  ) => void)[];
  server.removeAllListeners("request");
  const clientOrigin = runtime.config.clientOrigin;
  server.on("request", (request, response) => {
    const originalSetHeader = response.setHeader.bind(response);
    originalSetHeader("Access-Control-Allow-Origin", clientOrigin);
    originalSetHeader("Vary", "Origin");
    originalSetHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    originalSetHeader("Access-Control-Allow-Headers", "Content-Type");
    originalSetHeader("Access-Control-Max-Age", "600");
    // Later writers (the framework's default `*`/reflected origin) must not override the policy.
    response.setHeader = (
      name: string,
      value: number | string | readonly string[],
    ) => (CORS_HEADER.test(name) ? response : originalSetHeader(name, value));

    const path = (request.url ?? "/").split("?")[0] ?? "/";
    const origin = headerValue(request.headers.origin);
    if (request.method === "OPTIONS") {
      if (origin !== undefined && !isAdmittedOrigin(origin, clientOrigin)) {
        runtime.counters.originRejected += 1;
        runtime.logger.event("origin_rejected", { transport: "http" });
        response.removeHeader("Access-Control-Allow-Origin");
        response.writeHead(403);
        response.end();
        return;
      }
      // The SDK sends matchmaking with `credentials: include`, which browsers
      // allow only with an exact origin and this header. No cookies are used.
      if (path.startsWith("/matchmake/")) {
        originalSetHeader("Access-Control-Allow-Credentials", "true");
      }
      response.writeHead(204);
      response.end();
      return;
    }
    if (path.startsWith("/matchmake/")) {
      if (!isAdmittedOrigin(origin, clientOrigin)) {
        runtime.counters.originRejected += 1;
        runtime.logger.event("origin_rejected", { transport: "http" });
        response.removeHeader("Access-Control-Allow-Origin");
        sendJson(response, 403, {
          code: JOIN_ERROR_CODES.origin,
          error: JOIN_ERROR_MESSAGES.origin,
        });
        return;
      }
      originalSetHeader("Access-Control-Allow-Credentials", "true");
      const declared = Number(headerValue(request.headers["content-length"]));
      if (
        request.method === "POST" &&
        (!Number.isInteger(declared) ||
          declared < 0 ||
          declared > MAX_JOIN_BODY_BYTES)
      ) {
        runtime.counters.joinsRejected += 1;
        runtime.logger.event("join_rejected", { reason: "body_too_large" });
        sendJson(response, 413, {
          code: JOIN_ERROR_CODES.body_too_large,
          error: JOIN_ERROR_MESSAGES.body_too_large,
        });
        return;
      }
    }
    for (const listener of downstream) listener.call(server, request, response);
  });
}
