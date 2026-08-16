import { expect, test } from "@playwright/test";
import { cy, openApp } from "./support/app";

test.beforeEach(async ({ context, page }) => {
  // Deterministic system default: "System Default" needs a known OS
  // preference to resolve against, and setting it here doesn't affect
  // the other test in this file.
  await page.emulateMedia({ colorScheme: "dark" });
  await openApp(context, page);
});

test("theme follows the OS by default, and an explicit choice survives a reload", async ({
  page,
}) => {
  // System Default is the starting preference; the OS says dark.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await cy(page, "settingsButton").click();
  await cy(page, "themeOption-light").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("Escape");

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

/**
 * Which edge the progress panel sits on. Geometry is the assertion: a class
 * name would pass while the panel rendered on the wrong side.
 */
async function panelIsLeftOfCanvas(page: import("@playwright/test").Page) {
  const panel = await page.locator(".progress-panel").boundingBox();
  const canvas = await page.locator("#canvasScroll").boundingBox();
  return panel!.x < canvas!.x;
}

/** Which edge of the panel carries its hairline. */
async function dividerEdge(page: import("@playwright/test").Page) {
  return page.locator(".progress-panel").evaluate((el) => {
    const style = getComputedStyle(el);
    return parseFloat(style.borderRightWidth) > 0 ? "right" : "left";
  });
}

test("the progress panel side is a choice that survives a reload", async ({
  page,
}) => {
  // It follows the plan by default.
  expect(await panelIsLeftOfCanvas(page)).toBe(false);

  await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(cy(page, "movePanelButton")).toContainText("left");
  await cy(page, "movePanelButton").click();
  await expect.poll(() => panelIsLeftOfCanvas(page)).toBe(true);

  await page.reload();
  await cy(page, "roadSwitcher").waitFor();
  expect(await panelIsLeftOfCanvas(page)).toBe(true);

  // The divider travels with the panel, so it always faces the canvas
  // instead of drawing a hairline against the window.
  expect(await dividerEdge(page)).toBe("right");

  // The control now offers the way back, and takes it.
  await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(cy(page, "movePanelButton")).toContainText("right");
  await cy(page, "movePanelButton").click();
  await expect.poll(() => panelIsLeftOfCanvas(page)).toBe(false);

  await page.reload();
  await cy(page, "roadSwitcher").waitFor();
  expect(await panelIsLeftOfCanvas(page)).toBe(false);
});
