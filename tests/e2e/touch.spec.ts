import { expect, test, type Page } from "@playwright/test";
import { cy, openApp } from "./support/app";

/**
 * Controls the canvas and the audit reveal on hover. A coarse pointer
 * produces no hover state and no :focus-visible, so each one needs a
 * (hover: none) branch or it is unreachable: the tap lands on whatever
 * sits behind it, or on nothing drawn at all.
 */
test.use({
  viewport: { width: 375, height: 812 },
  hasTouch: true,
  isMobile: true,
});

/** Whether a real tap at the element's centre would reach the element. */
async function hitTestable(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el === null) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const top = document.elementFromPoint(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
    );
    return (
      style.opacity !== "0" &&
      style.pointerEvents !== "none" &&
      top !== null &&
      (el === top || el.contains(top))
    );
  }, selector);
}

async function placeClass(page: Page) {
  await page.locator("#searchInputTF").click();
  await page.locator(".palette-input").fill("8.01");
  await page.getByText("Classical Mechanics").first().click();
  const fall = page.locator('[data-cy$="__semester_1"]');
  await fall.click();
  await expect(fall.getByText("8.01").first()).toBeVisible();
  return fall;
}

test("a class can be removed from the road", async ({ context, page }) => {
  // The card's remove control is the only way off the road: the class
  // detail moves a class, it never drops one.
  await openApp(context, page);
  const fall = await placeClass(page);
  expect(await hitTestable(page, ".card-remove")).toBe(true);

  await page.locator(".card-remove").first().tap();
  await expect(fall.getByText("8.01")).toHaveCount(0);
});

test("an empty term shows what tapping it does", async ({ context, page }) => {
  await openApp(context, page);
  const label = page.locator(".term-empty-label").first();
  await expect(label).toBeVisible();
  expect(
    await page
      .locator(".term-empty-label")
      .first()
      .evaluate((el) => getComputedStyle(el).opacity),
  ).toBe("1");
});

test("audit row and program actions are reachable", async ({
  context,
  page,
}) => {
  await openApp(context, page);
  await page.getByRole("button", { name: "Progress" }).tap();
  await expect(cy(page, "audit")).toBeVisible();

  // Petition/ignore has no other entry point anywhere in the app.
  expect(await hitTestable(page, ".leaf-actions")).toBe(true);

  // These two carry no pointer-events guard, so hiding them left a live
  // hit target with nothing drawn in it.
  for (const selector of [".program-expandall", ".program-remove"]) {
    expect(await hitTestable(page, selector)).toBe(true);
  }
});

test.describe("with a fine pointer", () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });

  test("the same controls still rest hidden until hover", async ({
    context,
    page,
  }) => {
    // The touch branch must not leak: on a desktop the canvas stays quiet
    // and the controls arrive with the pointer.
    await openApp(context, page);
    await placeClass(page);
    const remove = page.locator(".card-remove").first();
    // Placing leaves the pointer over the new card, which reveals it. Step
    // off and let the fade finish before reading the resting state.
    await page.mouse.move(0, 0);
    await expect
      .poll(() => remove.evaluate((el) => getComputedStyle(el).opacity))
      .toBe("0");

    await page.locator(".class-card").first().hover();
    await expect
      .poll(() => remove.evaluate((el) => getComputedStyle(el).opacity))
      .toBe("1");
  });
});
