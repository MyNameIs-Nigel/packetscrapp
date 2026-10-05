import type { IncomingMessage } from "node:http";
import { WebSocketTransport } from "@colyseus/ws-transport";
import type { WebSocket } from "ws";

type TransportOptions = NonNullable<
  ConstructorParameters<typeof WebSocketTransport>[0]
>;

/**
 * The stock WebSocket transport with one addition: `onSocket` runs for every
 * accepted connection before Colyseus attaches its own listeners, so the
 * frame gate sees every inbound frame first.
 */
export class GatedWebSocketTransport extends WebSocketTransport {
  constructor(
    options: TransportOptions,
    onSocket: (socket: WebSocket, request: IncomingMessage) => void,
  ) {
    super(options);
    this.wss.prependListener("connection", onSocket);
  }
}
