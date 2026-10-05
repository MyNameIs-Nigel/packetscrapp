import { expect, test } from "@playwright/test";
import {
  HEALTH_URL,
  expectNoRooms,
  joinWaitingRoom,
  newPlayer,
  rosterNames,
  signIn,
} from "./helpers.ts";

test.beforeEach(async ({ request }) => {
  await expectNoRooms(request);
});

test("two independent browsers share one waiting room roster", async ({
  browser,
  request,
}) => {
  const ada = await newPlayer(browser);
  const ben = await newPlayer(browser);
  try {
    await joinWaitingRoom(ada.page, "Ada");
    await expect(ada.page.getByRole("status")).toContainText(
      "Connected to room",
    );
    await expect(ada.page.locator("#lobby-heading")).toBeFocused();
    await joinWaitingRoom(ben.page, "Ben");

    for (const page of [ada.page, ben.page]) {
      await expect.poll(() => rosterNames(page, "roster")).toHaveLength(2);
    }
    // Identity comes from the server: seats 0 and 1, and each page marks only its own entry.
    expect(await rosterNames(ada.page, "roster")).toEqual([
      "Seat 0 — Ada (you)",
      "Seat 1 — Ben",
    ]);
    expect(await rosterNames(ben.page, "roster")).toEqual([
      "Seat 0 — Ada",
      "Seat 1 — Ben (you)",
    ]);
    await expect(ada.page.locator("#player-count")).toHaveText("2");
    const health = (await (await request.get(HEALTH_URL)).json()) as {
      rooms: number;
      players: number;
    };
    expect(health).toMatchObject({ rooms: 1, players: 2 });

    await ben.page.locator("#leave-lobby").click();
    await expect(ben.page.getByRole("status")).toHaveText("You left the room.");
    await expect
      .poll(() => rosterNames(ada.page, "roster"))
      .toEqual(["Seat 0 — Ada (you)"]);
  } finally {
    await ada.context.close();
    await ben.context.close();
  }
});

test("a nickname is rendered as text, never as markup", async ({ browser }) => {
  const player = await newPlayer(browser);
  try {
    await joinWaitingRoom(player.page, "<img src=x onerror=alert(1)>");
    await expect(player.page.locator("#roster li")).toHaveText(
      "Seat 0 — <img src=x onerror=alert(1)> (you)",
    );
    await expect(player.page.locator("#roster img")).toHaveCount(0);
  } finally {
    await player.context.close();
  }
});

test("an invalid nickname keeps focus on the field with a specific error and joins nothing", async ({
  browser,
  request,
}) => {
  const player = await newPlayer(browser);
  try {
    await signIn(player.page, "   ");
    await player.page
      .getByRole("button", { name: "Join waiting room" })
      .click();
    await expect(player.page.locator("#nickname-error")).toHaveText(
      "Enter a nickname of 1 to 16 characters.",
    );
    await expect(
      player.page.getByLabel("Nickname (1–16 characters)"),
    ).toBeFocused();
    await signIn(player.page, "a".repeat(17));
    await player.page
      .getByRole("button", { name: "Join waiting room" })
      .click();
    await expect(player.page.locator("#nickname-error")).toHaveText(
      "Nicknames can be at most 16 characters.",
    );
    const health = (await (await request.get(HEALTH_URL)).json()) as {
      rooms: number;
    };
    expect(health.rooms).toBe(0);
  } finally {
    await player.context.close();
  }
});

test("an unreachable server shows the offline message and allows a retry", async ({
  browser,
}) => {
  const player = await newPlayer(browser);
  try {
    await signIn(player.page, "Ada");
    await player.page.getByLabel("Server URL").fill("http://127.0.0.1:1");
    await player.page
      .getByRole("button", { name: "Join waiting room" })
      .click();
    await expect(player.page.getByRole("status")).toHaveText(
      "Game servers are offline. Retry.",
    );
    await expect(
      player.page.getByRole("button", { name: "Join waiting room" }),
    ).toBeEnabled();
    await player.page.getByLabel("Server URL").fill("http://127.0.0.1:2567");
    await player.page
      .getByRole("button", { name: "Join waiting room" })
      .click();
    await expect(
      player.page.getByRole("heading", { name: "Waiting room" }),
    ).toBeVisible();
  } finally {
    await player.context.close();
  }
});
