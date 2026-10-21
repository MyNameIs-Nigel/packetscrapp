import { expect, test } from "@playwright/test";

test("two keyboard players harvest, build, get rejection feedback and keep focus boundaries", async ({
  browser,
}, testInfo) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  try {
    const alpha = await a.newPage(),
      bravo = await b.newPage();
    for (const [page, name] of [
      [alpha, "Alpha"],
      [bravo, "Bravo"],
    ] as const) {
      await page.goto("/");
      await page.locator("#nickname").fill(name);
      await page.locator("#prototype-seats").selectOption("2");
      await page.locator("#prototype-seed").fill("42");
      await page.locator("#start-build").click();
    }
    const board = alpha.locator("#board");
    await expect(board).toBeFocused();
    await expect(alpha.locator("#build-hud")).toContainText("Scrap 0");
    await expect(alpha.locator("#prototype-banner")).toContainText(
      "pauses when the Belt drops",
    );
    await board.press("Digit1");
    await expect(alpha.locator("#shop-feedback")).toContainText(
      "Need 10 scrap",
    );
    // Seed 42 has a reachable small deposit east of the reserved starting pose.
    await board.press("Space", { delay: 1200 });
    await expect(alpha.locator("#build-hud")).toContainText("Scrap 10");
    await board.press("Digit1");
    await expect(alpha.locator("#shop-feedback")).toContainText(
      "Purchased wall for 10 scrap",
    );
    await expect(alpha.locator("#build-hud")).toContainText("Scrap 0");
    await alpha.screenshot({
      path: testInfo.outputPath("build-loop.png"),
      fullPage: true,
    });
    await board.press("KeyQ");
    await expect(alpha.locator("#shop-feedback")).toContainText(
      "Need 50 scrap",
    );
    await expect(bravo.locator("#shop-feedback")).toHaveText("");
    await expect(bravo.locator("#build-hud")).toContainText("Scrap 0");
    // Gameplay controls act only on the focused board; Space on Leave cannot fire.
    await alpha.locator("#leave-game").focus();
    await alpha.keyboard.press("KeyQ");
    await expect(alpha.locator("#shop-feedback")).toContainText(
      "Need 50 scrap",
    );
    await alpha.locator("#leave-game").click();
    await expect(alpha.locator("#nickname")).toBeFocused();
    await expect(bravo.locator("#prototype-banner")).toContainText(
      "ended during build",
    );
  } finally {
    await a.close();
    await b.close();
  }
});
