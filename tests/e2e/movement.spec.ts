import { expect, test } from "@playwright/test";
import {
  expectNoRooms,
  isBoardFocused,
  newPlayer,
  rosterNames,
  ship,
  ships,
  stableShip,
  startPrototype,
  type PrototypeOptions,
} from "./helpers.ts";

test.beforeEach(async ({ request }) => {
  await expectNoRooms(request);
});

const BATTLE: PrototypeOptions = { seats: 2, seed: 42, view: "battle" };
const BUILD: PrototypeOptions = { seats: 2, seed: 42, view: "build" };

/** Two independent browser contexts in one prototype room. A joins first, so A is seat 0. */
async function twoPlayers(
  browser: Parameters<typeof newPlayer>[0],
  options: PrototypeOptions,
) {
  const a = await newPlayer(browser);
  const b = await newPlayer(browser);
  await startPrototype(a.page, "Alpha", options);
  await expect(
    a.page.getByRole("heading", { name: "Waiting room" }),
  ).toBeVisible();
  await startPrototype(b.page, "Bravo", options);
  for (const page of [a.page, b.page]) {
    await expect(
      page.getByRole("heading", { name: "Movement prototype" }),
    ).toBeVisible();
  }
  return { a, b };
}

/** The 2-player world is 48 x 24; a ship still 2 tiles inside the edge was stopped, not walled. */
const SAFE_Y = 21;

test("two browsers see identical server-owned movement and obey held-key rules", async ({
  browser,
}) => {
  const { a, b } = await twoPlayers(browser, BATTLE);
  try {
    // The labelled prototype tells the player what it is not, and the board takes focus once.
    await expect(a.page.locator("#prototype-banner")).toContainText(
      "Movement only — no scrap, combat, respawn or match flow",
    );
    expect(await isBoardFocused(a.page)).toBe(true);
    expect(await isBoardFocused(b.page)).toBe(true);
    // Pinned vector: two players, seed 42 -> seats own slots 0 and 1.
    for (const page of [a.page, b.page]) {
      expect(await ships(page)).toEqual([
        { seat: 0, x: 13, y: 11, facing: "right", alive: true },
        { seat: 1, x: 34, y: 11, facing: "left", alive: true },
      ]);
    }
    await expect(a.page.locator("#game-roster li")).toHaveText([
      "Seat 0 — Alpha (you)",
      "Seat 1 — Bravo",
    ]);

    // Hold down: the ship walks down on the server and both browsers agree, then it stops on release.
    await a.page.keyboard.down("ArrowDown");
    await expect
      .poll(async () => (await ship(a.page, 0))?.y ?? 0)
      .toBeGreaterThan(12);
    await a.page.keyboard.up("ArrowDown");
    const stopped = await stableShip(a.page, 0);
    expect(stopped).toMatchObject({ x: 13, facing: "down", alive: true });
    expect(stopped.y).toBeGreaterThan(12);
    expect(stopped.y).toBeLessThan(SAFE_Y);
    expect(await stableShip(b.page, 0)).toEqual(stopped);

    // Hold S, then D: D wins while held; releasing D resumes down; releasing S stops.
    await a.page.keyboard.down("KeyS");
    await a.page.keyboard.down("KeyD");
    await expect
      .poll(async () => (await ship(b.page, 0))?.facing)
      .toBe("right");
    const turnedX = (await ship(b.page, 0))?.x ?? 0;
    await a.page.keyboard.up("KeyD");
    await expect.poll(async () => (await ship(b.page, 0))?.facing).toBe("down");
    expect((await ship(b.page, 0))?.x).toBeGreaterThanOrEqual(turnedX);
    await a.page.keyboard.up("KeyS");
    const settled = await stableShip(b.page, 0);
    expect(settled.y).toBeLessThan(SAFE_Y);
    expect(await stableShip(a.page, 0)).toEqual(settled);

    // The other seat steers independently.
    await b.page.keyboard.down("KeyW");
    await expect
      .poll(async () => (await ship(a.page, 1))?.y ?? 99)
      .toBeLessThan(10);
    await b.page.keyboard.up("KeyW");
    // Release can leave a final server step in flight. Compare settled reads
    // from both clients, rather than freezing A before its final patch arrives.
    const bravoStopped = await stableShip(a.page, 1);
    expect(bravoStopped).toMatchObject({ x: 34, facing: "up", alive: true });
    expect(bravoStopped.y).toBeLessThan(10);
    expect(bravoStopped.y).toBeGreaterThan(1);
    expect(await stableShip(b.page, 1)).toEqual(bravoStopped);
  } finally {
    await a.context.close();
    await b.context.close();
  }
});

test("movement keys do nothing outside the focused game surface", async ({
  browser,
}) => {
  const { a, b } = await twoPlayers(browser, BATTLE);
  try {
    // Tab moves focus off the board; arrow keys then belong to the page, not the ship.
    await a.page.keyboard.press("Tab");
    expect(await isBoardFocused(a.page)).toBe(false);
    await a.page.keyboard.down("ArrowDown");
    await a.page.keyboard.down("KeyS");
    await a.page.waitForTimeout(500);
    await a.page.keyboard.up("ArrowDown");
    await a.page.keyboard.up("KeyS");
    expect(await ship(b.page, 0)).toMatchObject({ x: 13, y: 11 });
  } finally {
    await a.context.close();
    await b.context.close();
  }
});

test("losing focus stops the ship", async ({ browser }) => {
  const { a, b } = await twoPlayers(browser, BATTLE);
  try {
    await a.page.keyboard.down("ArrowDown");
    await expect
      .poll(async () => (await ship(b.page, 0))?.y ?? 0)
      .toBeGreaterThan(11);
    // The key is still physically held; only focus moves.
    await a.page.locator("#leave-game").focus();
    const stopped = await stableShip(b.page, 0);
    expect(stopped.y).toBeLessThan(SAFE_Y);
    expect(await stableShip(a.page, 0)).toEqual(stopped);
    await a.page.keyboard.up("ArrowDown");
  } finally {
    await a.context.close();
    await b.context.close();
  }
});

test("hiding the document stops the ship", async ({ browser }) => {
  const { a, b } = await twoPlayers(browser, BATTLE);
  try {
    await a.page.keyboard.down("ArrowDown");
    await expect
      .poll(async () => (await ship(b.page, 0))?.y ?? 0)
      .toBeGreaterThan(11);
    await a.page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        value: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const stopped = await stableShip(b.page, 0);
    expect(stopped.y).toBeLessThan(SAFE_Y);
    await a.page.keyboard.up("ArrowDown");
  } finally {
    await a.context.close();
    await b.context.close();
  }
});

test("a disconnect clears the held intent on the server", async ({
  browser,
}) => {
  const { a, b } = await twoPlayers(browser, BATTLE);
  try {
    await a.page.keyboard.down("ArrowDown");
    await expect
      .poll(async () => (await ship(b.page, 0))?.y ?? 0)
      .toBeGreaterThan(11);
    await a.context.close();
    await expect
      .poll(() => rosterNames(b.page, "game-roster"))
      .toEqual(["Seat 1 — Bravo (you)"]);
    const stopped = await stableShip(b.page, 0);
    expect(stopped.y).toBeLessThan(SAFE_Y);
  } finally {
    await b.context.close();
  }
});

test("a build-phase view carries only the player's own sector", async ({
  browser,
}) => {
  const { a, b } = await twoPlayers(browser, BUILD);
  try {
    await expect(a.page.locator("#prototype-banner")).toContainText(
      "build view",
    );
    expect(await ships(a.page)).toEqual([
      { seat: 0, x: 13, y: 11, facing: "right", alive: true },
    ]);
    expect(await ships(b.page)).toEqual([
      { seat: 1, x: 34, y: 11, facing: "left", alive: true },
    ]);
    // The roster is public; nothing about the other sector is in the page.
    await expect(a.page.locator("#game-roster li")).toHaveText([
      "Seat 0 — Alpha (you)",
      "Seat 1 — Bravo",
    ]);
    await a.page.keyboard.down("ArrowDown");
    await expect
      .poll(async () => (await ship(a.page, 0))?.y ?? 0)
      .toBeGreaterThan(12);
    await a.page.keyboard.up("ArrowDown");
    expect(await ships(b.page)).toEqual([
      { seat: 1, x: 34, y: 11, facing: "left", alive: true },
    ]);
    expect(await b.page.locator("#ships").innerText()).not.toContain("Seat 0");
  } finally {
    await a.context.close();
    await b.context.close();
  }
});

test("stepping into the build-phase Belt is lethal and never crosses it", async ({
  browser,
}) => {
  const { a, b } = await twoPlayers(browser, BUILD);
  try {
    await a.page.keyboard.down("ArrowDown");
    await expect
      .poll(async () => (await ship(a.page, 0))?.y ?? 0)
      .toBeGreaterThan(11);
    await a.page.keyboard.up("ArrowDown");
    await a.page.keyboard.down("ArrowRight");
    await expect
      .poll(async () => (await ship(a.page, 0))?.alive, { timeout: 15_000 })
      .toBe(false);
    await a.page.keyboard.up("ArrowRight");
    const lost = await ship(a.page, 0);
    expect(lost).toMatchObject({ x: 23, alive: false, facing: "right" });
    await expect(a.page.locator("#ships li")).toContainText("lost in the Belt");
    expect(await stableShip(a.page, 0)).toEqual(lost);
    // The other player never sees the first player's ship during build.
    expect((await ships(b.page)).map((row) => row.seat)).toEqual([1]);
  } finally {
    await a.context.close();
    await b.context.close();
  }
});
