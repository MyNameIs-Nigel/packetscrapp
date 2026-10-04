import { Room } from "@colyseus/core";

// Transport-only room. E1 replaces this with accepted join and movement rules.
export class FoundationRoom extends Room {
  override maxClients = 5;
}
