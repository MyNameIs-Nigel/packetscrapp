import { expect, test } from "@playwright/test";

test("built client connects through the SDK", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByRole("status")).toContainText("Connected to");
});
