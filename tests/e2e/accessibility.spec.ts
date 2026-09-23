import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  cy,
  mockFireroad,
  seedLocalRoads,
  seedReturningVisitor,
} from "./support/app";

/**
 * Keyboard and screen-reader contracts from the accessibility pass: the
 * class card's keys, the palette's combobox, the road switcher as a real
 * menu, and the audit's satisfied state in words.
 */

async function openRoad(context: BrowserContext, page: Page) {
  await mockFireroad(context);
  await seedReturningVisitor(context);
  await seedLocalRoads(context, {
    $0$: {
      name: "Course 6-3",
      coursesOfStudy: ["girs"],
      subjects: [
        { subject_id: "8.01", semester: 1 },
        { subject_id: "18.01", semester: 1 },
      ],
    },
    $1$: { name: "RoadB", coursesOfStudy: ["girs"], subjects: [] },
  });
  await page.goto("/road/$0$");
  await page.locator("#canvasScroll").waitFor();
}

test.beforeEach(async ({ context, page }) => {
  await openRoad(context, page);
});

test("Enter on a class card opens its detail", async ({ page }) => {
  const card = cy(page, "classInSemester1_8_01").locator(".card-body");
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(cy(page, "classInfoCard")).toBeVisible();
  await expect(page.locator(".trail-crumb.current")).toHaveText("8.01");
});

test("M moves a class card by keyboard, and focus follows it", async ({
  page,
}) => {
  const card = cy(page, "classInSemester1_8_01").locator(".card-body");
  await card.focus();
  await page.keyboard.press("m");
  await expect(page.locator(".placement-banner")).toContainText("Moving");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");

  await expect(cy(page, "classInSemester1_8_01")).toHaveCount(0);
  const moved = page.locator('[data-cy^="classInSemester"][data-cy$="_8_01"]');
  await expect(moved).toHaveCount(1);
  await expect(moved.locator(".card-body")).toBeFocused();
  // Nothing opened on the way: Enter placed the card, it did not click it.
  await expect(cy(page, "classInfoCard")).toBeHidden();
});

test("the palette is a modal combobox that returns focus", async ({ page }) => {
  const trigger = page.locator("#searchInputTF");
  await trigger.focus();
  await page.keyboard.press("ControlOrMeta+k");

  const input = page.getByRole("combobox", {
    name: "Search classes, filters, and commands",
  });
  await expect(input).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  // The app behind is hidden from assistive tech while it is open.
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toHaveCount(0);

  await input.fill("18.0");
  const first = await input.getAttribute("aria-activedescendant");
  await page.keyboard.press("ArrowDown");
  const second = await input.getAttribute("aria-activedescendant");
  expect(second).not.toBe(first);
  await expect(page.locator(`#${second}`)).toHaveAttribute(
    "data-highlighted",
    "",
  );

  // Tab completes a filter; Shift+Tab then moves focus as usual, to the
  // new filter chip, instead of placing a class.
  await input.fill("hass-a");
  await page.keyboard.press("Tab");
  await expect(input).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: /^Remove filter/ }),
  ).toBeFocused();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(undo).toHaveCount(1);
});

test("the road switcher is a menu with the active road checked", async ({
  page,
}) => {
  await cy(page, "roadSwitcher").click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(
    menu.getByRole("menuitemradio", { name: /Course 6-3/ }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    menu.getByRole("menuitemradio", { name: /RoadB/ }),
  ).toHaveAttribute("aria-checked", "false");

  // Rename opens a labelled field in a dialog, focused and ready to type.
  // The row actions reveal on the row's hover, as in roads.spec.ts.
  await page.locator(".road-name", { hasText: "RoadB" }).hover();
  await menu.getByRole("menuitem", { name: "Rename RoadB" }).click();
  const field = page.getByRole("textbox", { name: "Road name" });
  await expect(field).toBeFocused();
  await field.fill("Road C");
  await field.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(cy(page, "roadSwitcher")).toBeFocused();
});

test("switching Plan and Explore updates the page title", async ({ page }) => {
  await expect(page).toHaveTitle("Plan: Course 6-3 | CourseRoad");
  await cy(page, "exploreButton").click();
  await expect(page).toHaveTitle("Explore: Course 6-3 | CourseRoad");
});
