import type { IncomingMessage } from "node:http";
import { Protocol } from "@colyseus/core";
import { FrameWindowLimiter, MAX_FRAME_BYTES } from "@packetscrapp/shared";
import type { WebSocket } from "ws";
import type { ServerRuntime } from "./runtime.ts";

/** Colyseus protocol codes live in the low five bits of the first byte. */
const PROTOCOL_CODE_MASK = 0x1f;
/** Client frames the game accepts: join acknowledgement, leave, action data, ping. */
const ALLOWED_CODES: ReadonlySet<number> = new Set([
  Protocol.JOIN_ROOM,
  Protocol.LEAVE_ROOM,
  Protocol.ROOM_DATA,
  Protocol.PING,
]);
const CLOSE_POLICY_VIOLATION = 1008;
/** `ws` raises this when a frame exceeds `maxPayload`, after sending close code 1009. */
const OVERSIZE_ERROR_CODE = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";

function isOversizeError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === OVERSIZE_ERROR_CODE
  );
}

function firstByte(data: unknown): number | undefined {
  if (data instanceof Uint8Array) return data[0];
  return undefined;
}

/**
 * Sit in front of every inbound WebSocket frame, before Colyseus decodes it:
 *
 * 1. The first JOIN_ROOM acknowledgement is the connection handshake and is
 *    not an action, so it is passed through uncounted.
 * 2. Every other frame, valid or not, is counted in the connection's fixed
 *    one-second window (`FrameWindowLimiter`). Frames over the window limit
 *    are dropped; two consecutive flooded windows close only this connection.
 * 3. Frames that are not text-free binary Colyseus data/ping/leave frames are
 *    dropped and counted.
 * 4. A listener that throws while handling a frame closes this connection
 *    instead of the process.
 *
 * Frames above `MAX_FRAME_BYTES` never get here: the server's `maxPayload`
 * makes `ws` close the connection with 1009 before emitting the frame, and
 * the resulting `error` event is counted and swallowed below.
 */
export function attachFrameGate(
  socket: WebSocket,
  _request: IncomingMessage,
  runtime: ServerRuntime,
): void {
  const limiter = new FrameWindowLimiter(runtime.clock);
  let handshakeAcknowledged = false;
  let lastDropLog = -1;
  const originalEmit = socket.emit.bind(socket) as (
    event: string | symbol,
    ...args: unknown[]
  ) => boolean;

  const closeOffender = (): void => {
    socket.close(CLOSE_POLICY_VIOLATION, "policy");
    // A flooding peer need not complete the closing handshake.
    setTimeout(() => socket.terminate(), 250).unref();
  };

  socket.emit = ((event: string | symbol, ...args: unknown[]): boolean => {
    if (event === "error" && isOversizeError(args[0])) {
      // `ws` has already started closing with 1009. Count it and keep the
      // attacker-sized error and its stack out of the process output.
      runtime.counters.framesOversized += 1;
      runtime.logger.event("frame_rejected", { reason: "oversized" });
      return true;
    }
    if (event !== "message") return originalEmit(event, ...args);
    const [data, isBinary] = args;
    const code = firstByte(data);
    if (
      !handshakeAcknowledged &&
      isBinary === true &&
      code !== undefined &&
      (code & PROTOCOL_CODE_MASK) === Protocol.JOIN_ROOM
    ) {
      handshakeAcknowledged = true;
      return deliver();
    }
    const decision = limiter.onFrame();
    if (decision === "disconnect") {
      runtime.counters.floodDisconnects += 1;
      runtime.logger.event("flood_disconnect", {
        reason: "consecutive_windows",
      });
      closeOffender();
      return false;
    }
    if (decision === "drop") {
      runtime.counters.framesDropped += 1;
      const window = Math.floor(runtime.clock.now() / 1000);
      if (window !== lastDropLog) {
        lastDropLog = window;
        runtime.logger.event("frame_dropped", { reason: "rate_limit" });
      }
      return false;
    }
    const length = data instanceof Uint8Array ? data.byteLength : 0;
    if (
      isBinary !== true ||
      code === undefined ||
      length > MAX_FRAME_BYTES ||
      !ALLOWED_CODES.has(code & PROTOCOL_CODE_MASK)
    ) {
      runtime.counters.framesRejected += 1;
      runtime.logger.event("frame_rejected", { reason: "unsupported_frame" });
      return false;
    }
    return deliver();

    function deliver(): boolean {
      try {
        return originalEmit(event, ...args);
      } catch {
        runtime.logger.event("internal_error", { reason: "frame_handler" });
        socket.terminate();
        return false;
      }
    }
  }) as typeof socket.emit;
}
