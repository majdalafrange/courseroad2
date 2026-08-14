import { expect, test } from "@playwright/test";
import { cy, openApp } from "./support/app";

test.beforeEach(async ({ context, page }) => {
  await openApp(context, page);
});

test("compare opens from the switcher and Escape closes one layer", async ({
  page,
}) => {
  // Compare only offers itself once a second road exists; duplicating
  // the default road is the shortest way there.
  await cy(page, "roadSwitcher").click();
  await cy(page, "duplicateRoadButton").first().click({ force: true });

  await cy(page, "roadSwitcher").click();
  await cy(page, "compareRoadsButton").click();
  const dialog = page.getByRole("dialog", { name: "Compare roads" });
  await expect(dialog).toBeVisible();

  // The modal contract from GSheet: Escape closes exactly this layer.
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(cy(page, "roadSwitcher")).toBeVisible();
});
