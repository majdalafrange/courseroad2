import { expect, test } from "@playwright/test";
import { cy, openApp } from "./support/app";

test.beforeEach(async ({ context, page }) => {
  await openApp(context, page);
});

test("theme and IAP visibility survive a reload", async ({ page }) => {
  // Dark is the default until a student picks one.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await cy(page, "themeToggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await cy(page, "hideIapToggle").click();
  await expect(cy(page, "hideIapToggle")).toContainText("Show IAP");

  await page.reload();
  await cy(page, "roadSwitcher").waitFor();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(cy(page, "hideIapToggle")).toContainText("Show IAP");
});

test("the year choice survives a reload", async ({ page }) => {
  await expect(cy(page, "semester_title")).toContainText("Freshman");
  await cy(page, "semester_title").click();
  await cy(page, "selectClassYear").selectOption("2");
  await expect(cy(page, "semester_title")).toContainText("Junior");

  await page.reload();
  await cy(page, "roadSwitcher").waitFor();
  await expect(cy(page, "semester_title")).toContainText("Junior");
});
