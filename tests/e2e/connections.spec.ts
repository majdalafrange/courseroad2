import { expect, test } from "@playwright/test";
import { cy, openApp } from "./support/app";

test.beforeEach(async ({ context, page }) => {
  await openApp(context, page);
});

test("the connections surface opens in the same shell", async ({ page }) => {
  await cy(page, "exploreButton").click();
  // The :road segment travels with the mode, so switching roads while
  // exploring updates it in place instead of bouncing back to the plan.
  await expect(page).toHaveURL(/\/explore\/.+/);
  // An empty road shows the cold-start state naming the placement.
  await expect(
    page.getByText("Your road is empty. Pick a class to start from."),
  ).toBeVisible();
});

test("click selects a node; double-click expands it", async ({ page }) => {
  // Seed the road with a class that has dependents in the catalog.
  await page.locator("#searchInputTF").click();
  await page.locator(".palette-input").fill("18.01");
  await page.getByText("Calculus", { exact: true }).first().click();
  await page.locator('[data-cy$="__semester_1"]').click();
  await expect(
    page.locator('[data-cy$="__semester_1"]').getByText("18.01").first(),
  ).toBeVisible();

  await cy(page, "exploreButton").click();
  const node = cy(page, "connectionNode_18_01");
  await expect(node).toBeVisible();

  await node.click();
  await expect(cy(page, "connectionSelectedId")).toHaveText("18.01");

  const nodes = page.locator('[data-cy^="connectionNode_"]');
  const before = await nodes.count();
  await node.dblclick();
  await expect.poll(() => nodes.count()).toBeGreaterThan(before);
  // the double-clicked node stays selected
  await expect(cy(page, "connectionSelectedId")).toHaveText("18.01");
});

test("the Explore panel sits on the side the plan panel does", async ({
  page,
}) => {
  // Seed a class so selecting a node gives the panel something to show.
  await page.locator("#searchInputTF").click();
  await page.locator(".palette-input").fill("18.01");
  await page.getByText("Calculus", { exact: true }).first().click();
  await page.locator('[data-cy$="__semester_1"]').click();

  await cy(page, "settingsButton").click();
  await cy(page, "panelSideOption-right").click();
  await page.keyboard.press("Escape");

  await cy(page, "exploreButton").click();
  await cy(page, "connectionNode_18_01").click();
  const panel = page.locator(".node-panel");
  await expect(panel).toBeVisible();

  const box = await panel.boundingBox();
  const body = await page.locator(".connections-body").boundingBox();
  // Trailing edge of the row, following the plan panel to the right.
  expect(box!.x).toBeGreaterThan(body!.x + body!.width / 2);
});

test("switching roads while exploring stays on Explore and re-seeds", async ({
  page,
}) => {
  // Seed the first road with a class and open Explore from it.
  await page.locator("#searchInputTF").click();
  await page.locator(".palette-input").fill("18.01");
  await page.getByText("Calculus", { exact: true }).first().click();
  await page.locator('[data-cy$="__semester_1"]').click();

  await cy(page, "exploreButton").click();
  await expect(cy(page, "connectionNode_18_01")).toBeVisible();

  // A brand-new, empty road to switch to (creating it activates it
  // immediately; naming it isn't needed for this).
  await cy(page, "roadSwitcher").click();
  await cy(page, "addRoadButton").click();
  await page.keyboard.press("Escape");

  // Still exploring, not bounced back to the plan...
  await expect(page).toHaveURL(/\/explore\/.+/);
  // ...and the graph re-seeded from the new (empty) road instead of
  // carrying over 18.01 from the one that was left.
  await expect(
    page.getByText("Your road is empty. Pick a class to start from."),
  ).toBeVisible();
});
