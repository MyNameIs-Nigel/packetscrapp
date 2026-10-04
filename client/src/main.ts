import { Client, type Room } from "@colyseus/sdk";
import { PROTOCOL_VERSION } from "@packetscrapp/shared";

const input = document.querySelector<HTMLInputElement>("#server-url");
const button = document.querySelector<HTMLButtonElement>("#connect");
const status = document.querySelector<HTMLElement>("#status");
if (!input || !button || !status) {
  throw new Error("Connection harness elements are missing");
}
const serverInput = input;
const connectButton = button;
const statusNode = status;
if (["localhost", "127.0.0.1"].includes(location.hostname)) {
  serverInput.value = "http://127.0.0.1:2567";
}
let room: Room | undefined;
connectButton.addEventListener("click", () => {
  void connect();
});

async function connect(): Promise<void> {
  connectButton.disabled = true;
  statusNode.textContent = "Connecting…";
  try {
    if (room) {
      await room.leave();
      room = undefined;
    }
    const endpoint = new URL(serverInput.value);
    const healthResponse = await fetch(new URL("/health", endpoint), {
      cache: "no-store",
    });
    if (!healthResponse.ok) {
      throw new Error(`Health returned ${healthResponse.status}`);
    }
    const health: unknown = await healthResponse.json();
    if (!isCompatibleHealth(health)) {
      throw new Error("Server protocol is incompatible");
    }
    const joined = await new Client(endpoint.href).joinOrCreate("foundation");
    room = joined;
    statusNode.textContent = `Connected to ${joined.roomId}`;
    joined.onLeave(() => {
      if (room === joined) {
        statusNode.textContent = "Disconnected";
        room = undefined;
      }
    });
  } catch (error) {
    statusNode.textContent =
      error instanceof Error ? error.message : String(error);
  } finally {
    connectButton.disabled = false;
  }
}

function isCompatibleHealth(
  value: unknown,
): value is { protocolVersion: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "protocolVersion" in value &&
    value.protocolVersion === PROTOCOL_VERSION
  );
}
