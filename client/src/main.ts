import { Client, type Room } from "@colyseus/sdk";
import {
  FIXTURE_VIEWS,
  JOIN_ERROR_MESSAGES,
  MAX_SEATS,
  MESSAGE_MOVE,
  MESSAGE_WELCOME,
  MIN_FIXTURE_SEATS,
  PROTOCOL_VERSION,
  ROOM_MATCH,
  ROOM_PROTOTYPE,
  isHealthDocument,
  isJoinableHealth,
  joinRejectionFromMessage,
  sanitizeNickname,
  type MoveIntent,
} from "@packetscrapp/shared";
import { TileAnimator } from "./animation.ts";
import { IntentSender, KeyIntentTracker } from "./input.ts";
import { BoardRenderer } from "./render.ts";
import { readRoomView, type RoomView } from "./view.ts";

const environment = __CLIENT_ENV__;
/** The movement prototype and its controls exist only in local builds. */
const prototypeEnabled = environment === "local";
/** Region selection arrives in E6; only a local build has a known server. */
const LOCAL_SERVER = "http://127.0.0.1:2567";
const HEALTH_TIMEOUT_MS = 2000;

function required<T extends HTMLElement>(id: string, type: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`Missing element #${id}`);
  return element;
}

const form = required("join-form", HTMLFormElement);
const nicknameInput = required("nickname", HTMLInputElement);
const nicknameError = required("nickname-error", HTMLElement);
const serverField = required("server-field", HTMLElement);
const serverInput = required("server-url", HTMLInputElement);
const joinButton = required("join", HTMLButtonElement);
const extras = required("extras", HTMLElement);
const startSection = required("start", HTMLElement);
const lobbySection = required("lobby", HTMLElement);
const lobbyHeading = required("lobby-heading", HTMLElement);
const lobbyNote = required("lobby-note", HTMLElement);
const playerCount = required("player-count", HTMLElement);
const rosterList = required("roster", HTMLElement);
const leaveLobby = required("leave-lobby", HTMLButtonElement);
const gameSection = required("game", HTMLElement);
const gameHeading = required("game-heading", HTMLElement);
const banner = required("prototype-banner", HTMLElement);
const board = required("board", HTMLCanvasElement);
const gameStatus = required("game-status", HTMLElement);
const legend = required("legend", HTMLElement);
const shipList = required("ships", HTMLElement);
const gameRoster = required("game-roster", HTMLElement);
const leaveGame = required("leave-game", HTMLButtonElement);
const statusNode = required("status", HTMLElement);

const renderer = new BoardRenderer(board);
const animators = new Map<number, TileAnimator>();
const tracker = new KeyIntentTracker();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let room: Room | undefined;
let ownSeat: number | undefined;
let leaving = false;
let latest: RoomView = readRoomView(undefined);
let screen: "start" | "lobby" | "game" = "start";
let frame = 0;
let prototypeControls: { read(): Record<string, unknown> } | undefined;

const sender = new IntentSender((intent: MoveIntent) => {
  room?.send(MESSAGE_MOVE, { direction: intent });
});

function setStatus(message: string): void {
  statusNode.textContent = message;
}

function showScreen(next: "start" | "lobby" | "game"): void {
  screen = next;
  startSection.hidden = next !== "start";
  lobbySection.hidden = next !== "lobby";
  gameSection.hidden = next !== "game";
  if (next === "game") {
    if (frame === 0) frame = requestAnimationFrame(drawFrame);
  } else if (frame !== 0) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
}

if (environment === "local") {
  serverField.hidden = false;
  serverInput.value = LOCAL_SERVER;
}

if (prototypeEnabled) {
  prototypeControls = mountPrototypeControls(extras);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void join(ROOM_MATCH);
});

leaveLobby.addEventListener("click", () => void leaveRoom());
leaveGame.addEventListener("click", () => void leaveRoom());

/** Local-only controls for the movement prototype. Never mounted in a development or production build. */
function mountPrototypeControls(container: HTMLElement): {
  read(): Record<string, unknown>;
} {
  const heading = document.createElement("h3");
  heading.textContent = "Local movement prototype";
  const note = document.createElement("p");
  note.className = "muted";
  note.textContent =
    "Prototype only (local builds): server-owned ship movement on fixed test maps. No scrap, combat, respawn or match flow.";
  const seats = document.createElement("select");
  seats.id = "prototype-seats";
  for (let count = MIN_FIXTURE_SEATS; count <= MAX_SEATS; count += 1) {
    seats.append(new Option(`${count} players`, String(count)));
  }
  const seed = document.createElement("input");
  seed.id = "prototype-seed";
  seed.type = "number";
  seed.min = "0";
  seed.max = "4294967295";
  seed.value = "42";
  const view = document.createElement("select");
  view.id = "prototype-view";
  for (const name of FIXTURE_VIEWS) {
    view.append(
      new Option(
        name === "build"
          ? "Build view (own sector, Belt up)"
          : "Battle view (everything visible)",
        name,
      ),
    );
  }
  const labelFor = (text: string, control: HTMLElement): HTMLLabelElement => {
    const label = document.createElement("label");
    label.htmlFor = control.id;
    label.textContent = text;
    return label;
  };
  const start = document.createElement("button");
  start.type = "button";
  start.id = "start-prototype";
  start.textContent = "Start movement prototype";
  start.addEventListener("click", () => void join(ROOM_PROTOTYPE));
  container.append(
    heading,
    note,
    labelFor("Players in the test room", seats),
    seats,
    labelFor("Map seed (0 to 4294967295)", seed),
    seed,
    labelFor("Fixture view", view),
    view,
    start,
  );
  return {
    read: () => ({
      seats: Number(seats.value),
      seed: Number(seed.value),
      view: view.value,
    }),
  };
}

/** Returns why this server cannot be joined, or `undefined` when it can. */
async function fetchHealth(endpoint: URL): Promise<string | undefined> {
  let body: unknown;
  try {
    const response = await fetch(new URL("/health", endpoint), {
      cache: "no-store",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (!response.ok) return "Game servers are offline. Retry.";
    body = await response.json();
  } catch {
    return "Game servers are offline. Retry.";
  }
  if (!isHealthDocument(body)) {
    return "This server is not compatible with this page. Reload and try again.";
  }
  if (body.protocol !== PROTOCOL_VERSION || body.environment !== environment) {
    return "This page and the server are not compatible. Reload and try again.";
  }
  if (!isJoinableHealth(body, environment)) {
    return JOIN_ERROR_MESSAGES.capacity;
  }
  return undefined;
}

function describeJoinError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return joinRejectionFromMessage(message) !== undefined
    ? message
    : "Could not join. Check the server and try again.";
}

async function join(
  kind: typeof ROOM_MATCH | typeof ROOM_PROTOTYPE,
): Promise<void> {
  if (room) return;
  nicknameError.textContent = "";
  const nickname = sanitizeNickname(nicknameInput.value);
  if (!nickname.ok) {
    nicknameError.textContent =
      nickname.reason === "name_empty"
        ? JOIN_ERROR_MESSAGES.name_empty
        : JOIN_ERROR_MESSAGES.name_too_long;
    nicknameInput.focus();
    return;
  }
  const serverUrl = environment === "local" ? serverInput.value : "";
  let endpoint: URL;
  try {
    endpoint = new URL(serverUrl);
    if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    setStatus(
      environment === "local"
        ? "Enter a valid server URL."
        : "This build has no game server configured yet; region selection arrives in a later phase.",
    );
    return;
  }
  joinButton.disabled = true;
  setStatus("Joining…");
  try {
    const problem = await fetchHealth(endpoint);
    if (problem !== undefined) {
      setStatus(problem);
      return;
    }
    const options: Record<string, unknown> = {
      name: nickname.name,
      protocol: PROTOCOL_VERSION,
      environment,
      ...(kind === ROOM_PROTOTYPE ? prototypeControls?.read() : {}),
    };
    const joined = await new Client(endpoint.href).joinOrCreate(kind, options);
    attach(joined);
  } catch (error) {
    setStatus(describeJoinError(error));
    joinButton.focus();
  } finally {
    joinButton.disabled = false;
  }
}

function attach(joined: Room): void {
  room = joined;
  ownSeat = undefined;
  leaving = false;
  latest = readRoomView(undefined);
  animators.clear();
  tracker.reset();
  sender.restart();
  joined.onMessage(MESSAGE_WELCOME, (message: unknown) => {
    if (
      typeof message === "object" &&
      message !== null &&
      "seat" in message &&
      typeof message.seat === "number"
    ) {
      ownSeat = message.seat;
      renderAll();
    }
  });
  joined.onStateChange(() => {
    if (room !== joined) return;
    latest = readRoomView(joined.state);
    renderAll();
  });
  joined.onLeave(() => {
    if (room !== joined) return;
    releaseKeys();
    const expected = leaving;
    room = undefined;
    ownSeat = undefined;
    showScreen("start");
    setStatus(
      expected ? "You left the room." : "Disconnected from the server.",
    );
    nicknameInput.focus();
  });
  joined.onError(() => {
    if (room === joined) setStatus("Connection problem.");
  });
  latest = readRoomView(joined.state);
  renderAll();
  setStatus(`Connected to room ${joined.roomId}.`);
}

async function leaveRoom(): Promise<void> {
  const current = room;
  if (!current) return;
  leaving = true;
  releaseKeys();
  try {
    await current.leave();
  } catch {
    // The socket is already closed; onLeave resets the page.
  }
}

function seatLabel(view: RoomView, seat: number): string {
  const name = view.players.find((player) => player.seat === seat)?.name;
  const you = seat === ownSeat ? " (you)" : "";
  return `Seat ${seat}${name ? ` — ${name}` : ""}${you}`;
}

function fillRoster(list: HTMLElement, view: RoomView): void {
  list.replaceChildren(
    ...view.players.map((player) => {
      const item = document.createElement("li");
      item.dataset.seat = String(player.seat);
      item.textContent = `${seatLabel(view, player.seat)}${player.bot ? " [BOT]" : ""}`;
      return item;
    }),
  );
}

let focusedGame = false;

function renderAll(): void {
  const view = latest;
  const running =
    view.prototype && (view.phase === "build" || view.phase === "battle");
  syncAnimators(view);
  if (running) {
    if (screen !== "game") {
      showScreen("game");
      // The game surface takes focus once, when the match starts.
      if (!focusedGame) {
        focusedGame = true;
        board.focus();
      }
    }
    renderGame(view);
    return;
  }
  focusedGame = false;
  if (screen !== "lobby") {
    showScreen("lobby");
    lobbyHeading.focus();
  }
  playerCount.textContent = String(view.players.length);
  fillRoster(rosterList, view);
  lobbyNote.textContent = view.prototype
    ? "Local movement prototype room: the test map starts when every seat is filled."
    : "Waiting for more players. The match itself is not built yet.";
}

function renderGame(view: RoomView): void {
  gameHeading.textContent = "Movement prototype";
  banner.textContent =
    view.phase === "build"
      ? "Local prototype, build view: you see only your own sector and the lethal Belt. Movement only — no scrap, combat, respawn or match flow. A ship that enters the Belt is lost for this test."
      : "Local prototype, battle view: every sector is visible and the Belt is gone. Movement only — no scrap, combat, respawn or match flow.";
  legend.textContent =
    view.phase === "build"
      ? "Hatched orange bands are the asteroid Belt (lethal while it is up). Hatched dark sectors are hidden."
      : "Squares are cores, diamonds are deposits, triangles are ships pointing the way they face.";
  gameStatus.textContent = `Phase: ${view.phase} · tick ${view.tick} · ${view.playerCount} players · Move with WASD or arrow keys while the board has focus.`;
  renderer.configure(view.playerCount);
  shipList.replaceChildren(
    ...view.ships.map((ship) => {
      const item = document.createElement("li");
      item.dataset.seat = String(ship.seat);
      item.dataset.x = String(ship.x);
      item.dataset.y = String(ship.y);
      item.dataset.facing = ship.facing;
      item.dataset.alive = String(ship.alive);
      item.textContent = `${seatLabel(view, ship.seat)}: x ${ship.x}, y ${ship.y}, facing ${ship.facing}${ship.alive ? "" : ", lost in the Belt"}`;
      return item;
    }),
  );
  fillRoster(gameRoster, view);
}

function syncAnimators(view: RoomView): void {
  const now = performance.now();
  const seen = new Set<number>();
  for (const ship of view.ships) {
    seen.add(ship.seat);
    const existing = animators.get(ship.seat);
    if (existing) existing.update(ship, now, !reducedMotion.matches);
    else animators.set(ship.seat, new TileAnimator(ship, now));
  }
  for (const seat of [...animators.keys()]) {
    if (!seen.has(seat)) animators.delete(seat);
  }
}

function drawFrame(): void {
  frame = 0;
  if (screen !== "game") return;
  renderer.draw({ view: latest, ownSeat, animators, now: performance.now() });
  frame = requestAnimationFrame(drawFrame);
}

function releaseKeys(): void {
  sender.set(tracker.reset());
}

// Movement keys act only while the game surface has focus; typing elsewhere,
// scrolling the page, and Tab never reach the server.
board.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const intent = tracker.keyDown(event.code);
  if (intent === undefined) return;
  event.preventDefault();
  if (!event.repeat) sender.set(intent);
});
board.addEventListener("keyup", (event) => {
  const intent = tracker.keyUp(event.code);
  if (intent === undefined) return;
  event.preventDefault();
  sender.set(intent);
});
board.addEventListener("blur", releaseKeys);
window.addEventListener("blur", releaseKeys);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseKeys();
});
