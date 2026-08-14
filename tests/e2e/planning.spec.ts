import { expect, test } from "@playwright/test";
import { cy, openApp } from "./support/app";

test.beforeEach(async ({ context, page }) => {
  await openApp(context, page);
});

test("palette search places a class; undo takes it back", async ({ page }) => {
  // A palette click starts click-to-place; the term click completes it.
  await page.locator("#searchInputTF").click();
  await page.locator(".palette-input").fill("8.01");
  await page.getByText("Classical Mechanics").first().click();
  const fall = page.locator('[data-cy$="__semester_1"]');
  await expect(fall.getByText("Choose a term below")).toHaveCount(0);
  await fall.click();

  await expect(fall.getByText("8.01").first()).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(fall.getByText("8.01")).toHaveCount(0);
});

test("the empty-term add control opens the palette scoped to it", async ({
  page,
}) => {
  // semester_3 is Spring of year 1 and starts empty
  await page.locator('[data-cy$="__semester_3_emptyAdd"]').click();
  await expect(page.locator(".palette")).toBeVisible();
  // the term's season arrives as an active filter token
  await expect(page.locator(".token-chip")).toContainText("Spring");
  // a search from there still places into that term
  await page.locator(".palette-input").fill("18.01");
  await page.getByText("Calculus", { exact: true }).first().click();
  const spring = page.locator('[data-cy$="__semester_3"]');
  await spring.click();
  await expect(spring.getByText("18.01").first()).toBeVisible();
});

/* Each season name has to survive the trip to a token key, and IAP is the
   one where the casing differs ("IAP" against the "iap" key). A season that
   fails to map is silent: the palette opens unscoped rather than erroring. */
test("each season's add control scopes to that season", async ({ page }) => {
  for (const [index, season] of [
    [1, "Fall"],
    [2, "IAP"],
    [3, "Spring"],
  ] as const) {
    await page.locator(`[data-cy$="__semester_${index}_emptyAdd"]`).click();
    await expect(page.locator(".palette")).toBeVisible();
    await expect(page.locator(".token-chip")).toHaveText(season);
    await page.keyboard.press("Escape");
    await expect(page.locator(".palette")).toBeHidden();
  }
});

test("the detail card names a repeat before adding one", async ({ page }) => {
  await page.locator("#searchInputTF").click();
  await page.locator(".palette-input").fill("8.01");
  await page.getByText("Classical Mechanics").first().click();
  const fall = page.locator('[data-cy$="__semester_1"]');
  await fall.click();
  await expect(fall.getByText("8.01").first()).toBeVisible();

  // Open the placed class's detail. Its term buttons add a repeat, and
  // the card says so the way the Connections term picker does.
  await fall.getByText("8.01").first().click();
  await expect(cy(page, "cardRepeatNote")).toContainText("This adds a repeat");
});

/**
 * Dropping a card must not also open it, and the suppression that ensures
 * that must not outlive the drop. A move takes the pressed card out of the
 * DOM, so no click follows the pointerup, and an unbounded suppression sat
 * armed until the student's next click and swallowed that one instead.
 */
test.describe("the click after a drag", () => {
  async function placeAndDrag(page: import("@playwright/test").Page) {
    await page.locator("#searchInputTF").click();
    await page.locator(".palette-input").fill("8.01");
    await page.getByText("Classical Mechanics").first().click();
    const fall = page.locator('[data-cy$="__semester_1"]');
    await fall.click();
    await expect(fall.getByText("8.01").first()).toBeVisible();

    const spring = page.locator('[data-cy$="__semester_3"]');
    await fall.getByText("8.01").first().hover();
    await page.mouse.down();
    const box = await spring.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2, {
      steps: 20,
    });
    await page.mouse.up();
    await expect(spring.getByText("8.01").first()).toBeVisible();
    return spring;
  }

  test("does not open the card that was dropped", async ({ page }) => {
    await placeAndDrag(page);
    await expect(cy(page, "classInfoCard")).toBeHidden();
  });

  test("still reaches the term's Hydrant link", async ({ context, page }) => {
    await context.route("https://hydrant.mit.edu/**", (route) =>
      route.fulfill({ body: "<html></html>", contentType: "text/html" }),
    );
    const spring = await placeAndDrag(page);
    const popup = page.waitForEvent("popup", { timeout: 5000 });
    await spring.locator("a.term-hydrant").click();
    expect((await popup).url()).toContain("hydrant.mit.edu");
  });
});

test("a placed class updates the term units", async ({ page }) => {
  await page.locator("#searchInputTF").click();
  await page.locator(".palette-input").fill("18.01");
  await page.getByText("Calculus", { exact: true }).first().click();
  const fall = page.locator('[data-cy$="__semester_1"]');
  await fall.click();
  await expect(fall.getByText("18.01").first()).toBeVisible();
  await expect(cy(page, "semesterUnits").first()).toContainText("12");
});
