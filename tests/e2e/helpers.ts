import {
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

export const HEALTH_URL = "http://127.0.0.1:2567/health";

export interface ShipRow {
  seat: number;
  x: number;
  y: number;
  facing: string;
  alive: boolean;
}

/** A browser context with fresh storage and its own page, as an independent player. */
export async function newPlayer(
  browser: Browser,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  return { context, page };
}

/** Wait for the server to report no rooms, so a test never joins a previous test's room. */
export async function expectNoRooms(request: APIRequestContext): Promise<void> {
  await expect
    .poll(
      async () =>
        ((await (await request.get(HEALTH_URL)).json()) as { rooms: number })
          .rooms,
      { timeout: 10_000 },
    )
    .toBe(0);
}

export async function signIn(page: Page, name: string): Promise<void> {
  await page.getByLabel("Nickname (1–16 characters)").fill(name);
}

export async function joinWaitingRoom(page: Page, name: string): Promise<void> {
  await signIn(page, name);
  await page.getByRole("button", { name: "Join waiting room" }).click();
  await expect(
    page.getByRole("heading", { name: "Waiting room" }),
  ).toBeVisible();
}

export interface PrototypeOptions {
  seats: number;
  seed: number;
  view: "build" | "battle";
}

export async function startPrototype(
  page: Page,
  name: string,
  options: PrototypeOptions,
): Promise<void> {
  await signIn(page, name);
  await page
    .getByLabel("Players in the test room")
    .selectOption(String(options.seats));
  await page
    .getByLabel("Map seed (0 to 4294967295)")
    .fill(String(options.seed));
  await page.getByLabel("Fixture view").selectOption(options.view);
  await page.getByRole("button", { name: "Start movement prototype" }).click();
}

export async function rosterNames(
  page: Page,
  listId: string,
): Promise<string[]> {
  return page.locator(`#${listId} li`).allTextContents();
}

/** Ships exactly as the HUD lists them from the state this page received. */
export async function ships(page: Page): Promise<ShipRow[]> {
  return page.locator("#ships li").evaluateAll((items) =>
    items.map((item) => {
      const data = (item as HTMLElement).dataset;
      return {
        seat: Number(data.seat),
        x: Number(data.x),
        y: Number(data.y),
        facing: data.facing ?? "",
        alive: data.alive === "true",
      };
    }),
  );
}

export async function ship(
  page: Page,
  seat: number,
): Promise<ShipRow | undefined> {
  return (await ships(page)).find((row) => row.seat === seat);
}

export async function isBoardFocused(page: Page): Promise<boolean> {
  return page.evaluate(() => document.activeElement?.id === "board");
}
