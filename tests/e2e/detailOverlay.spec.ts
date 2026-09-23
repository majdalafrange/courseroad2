import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  cy,
  mockFireroad,
  openSettings,
  seedLocalRoads,
  seedReturningVisitor,
} from "./support/app";

/**
 * A class detail opened from the audit covers the audit instead of
 * displacing it: the tree keeps its scroll and its rows, the covered rows
 * leave the tab order, and closing the detail puts focus back on the row
 * that opened it.
 */

const SUBJECTS = ["8.01", "18.01", "18.02", "8.02", "6.0001", "6.006"];

/** One program tall enough to scroll: eight open blocks of subject leaves. */
const TALL_PROGRESS = {
  "list-id": "major6-3.reql",
  title: "Bachelor of Science in Computer Science and Engineering",
  "medium-title": "6-3 Major",
  "short-title": "6-3",
  percent_fulfilled: 40,
  fulfilled: false,
  reqs: Array.from({ length: 8 }, (_, block) => ({
    title: `Block ${block + 1}`,
    percent_fulfilled: 0,
    fulfilled: false,
    reqs: SUBJECTS.map((req) => ({
      req,
      fulfilled: false,
      percent_fulfilled: 0,
      progress: 0,
      max: 1,
    })),
  })),
};

async function openTallRoad(context: BrowserContext, page: Page) {
  await mockFireroad(context);
  // Registered after the fixtures, so it answers first.
  await context.route(
    "https://fireroad.mit.edu/requirements/progress/**",
    (route) => route.fulfill({ json: TALL_PROGRESS }),
  );
  await seedReturningVisitor(context);
  await seedLocalRoads(context, {
    $0$: {
      name: "Course 6-3",
      coursesOfStudy: ["major6-3"],
      subjects: [
        { subject_id: "8.01", semester: 1 },
        { subject_id: "18.01", semester: 1 },
      ],
    },
  });
  await page.goto("/");
  await cy(page, "roadSwitcher").waitFor();
  await expect(page.locator(".leaf-row")).toHaveCount(48);
}

/** Scroll the audit, then return a leaf row in the middle of its view. */
async function scrolledRow(page: Page): Promise<Locator> {
  const audit = cy(page, "audit");
  await audit.evaluate((el) => {
    el.scrollTop = 600;
  });
  const hook = await audit.evaluate((el) => {
    const view = el.getBoundingClientRect();
    const middle = view.top + view.height / 2;
    const rows = [...el.querySelectorAll(".leaf-row")];
    const row = rows.find((candidate) => {
      const box = candidate.getBoundingClientRect();
      return box.top <= middle && box.bottom >= middle;
    });
    return row?.getAttribute("data-cy") ?? "";
  });
  expect(hook).not.toBe("");
  return cy(page, hook);
}

/** Whether keyboard focus is anywhere inside the audit. */
function focusInAudit(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const active = document.activeElement;
    return active !== null && active.closest('[data-cy="audit"]') !== null;
  });
}

/** Where focus lands when a detail opens: its scrolling body. */
function detailFocus(page: Page): Locator {
  return cy(page, "classInfoBody");
}

test.describe("the detail over the audit", () => {
  test.beforeEach(async ({ context, page }) => {
    await openTallRoad(context, page);
  });

  test("keeps the audit's scroll and rows, and returns focus to the row", async ({
    page,
  }) => {
    const audit = cy(page, "audit");
    const row = await scrolledRow(page);
    const rowCount = await page.locator('[data-cy^="auditItem"]').count();
    const scrollTop = await audit.evaluate((el) => el.scrollTop);
    const rowTop = (await row.boundingBox())?.y;

    await row.click();
    const detail = cy(page, "classInfoCard");
    await expect(detail).toBeVisible();
    await expect(detailFocus(page)).toBeFocused();
    await expect(audit).toHaveAttribute("inert");

    // Covered, not displaced: same scroll, every row mounted, the clicked
    // row where it was, and the detail over exactly the audit's box.
    expect(await audit.evaluate((el) => el.scrollTop)).toBe(scrollTop);
    await expect(page.locator('[data-cy^="auditItem"]')).toHaveCount(rowCount);
    expect((await row.boundingBox())?.y).toBe(rowTop);
    const auditBox = await audit.boundingBox();
    await expect
      .poll(async () => (await detail.boundingBox())?.y)
      .toBe(auditBox?.y);
    expect((await detail.boundingBox())?.height).toBe(auditBox?.height);
    // The footer and its official-audit link stay outside the cover.
    await expect(
      cy(page, "unofficialWarning").getByRole("link", {
        name: /official audit/,
      }),
    ).toBeInViewport();

    await page.keyboard.press("Escape");
    await expect(detail).toBeHidden();
    await expect(audit).not.toHaveAttribute("inert");
    await expect(row).toBeFocused();
    expect(await audit.evaluate((el) => el.scrollTop)).toBe(scrollTop);
  });

  test("opens from the keyboard and keeps Tab out of the covered rows", async ({
    page,
  }) => {
    const row = await scrolledRow(page);
    const detail = cy(page, "classInfoCard");

    for (const key of ["Enter", " "]) {
      await row.focus();
      await page.keyboard.press(key);
      await expect(detailFocus(page)).toBeFocused();
      await expect(cy(page, "audit")).toHaveAttribute("inert");

      // The audit sits just before the detail in the document. From the
      // detail's body, Shift+Tab passes the trail's close button and crumb,
      // and the next press would land on the audit's last control if the
      // covered rows were still reachable.
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press("Shift+Tab");
        expect(await focusInAudit(page)).toBe(false);
      }
      // Back on the detail first: from a live control elsewhere, closing
      // leaves focus there instead of returning it to the row.
      await detailFocus(page).focus();
      await page.keyboard.press("Escape");
      await expect(detail).toBeHidden();
      await expect(row).toBeFocused();
    }
  });

  test("opened from a canvas card, leaves focus on the card", async ({
    page,
  }) => {
    const card = cy(page, "classInSemester1_8_01");
    await card.click();
    await expect(cy(page, "classInfoCard")).toBeVisible();
    await expect(card).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(cy(page, "classInfoCard")).toBeHidden();
    await expect(card).toBeFocused();
  });

  test("shows the inset focus ring on a keyboard open, none on a click", async ({
    page,
  }) => {
    const row = await scrolledRow(page);
    const body = detailFocus(page);
    const ring = () => body.evaluate((el) => getComputedStyle(el).boxShadow);

    await row.click();
    await expect(body).toBeFocused();
    expect(await ring()).toBe("none");

    await page.keyboard.press("Escape");
    await expect(row).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(body).toBeFocused();
    // Drawn inside: the aside clips anything outside the panel's edges.
    expect(await ring()).toMatch(/inset/);
  });

  test("keeps focus in the detail when a prerequisite opens another class", async ({
    page,
  }) => {
    // 6.006 lists 6.0001 among its prerequisites.
    const row = page.locator(".leaf-row", { hasText: "6.006" }).first();
    await row.click();
    const detail = cy(page, "classInfoCard");
    await expect(detailFocus(page)).toBeFocused();

    const chip = detail.locator(".prereq-chip", { hasText: "6.0001" }).first();
    await chip.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".trail-crumb.current")).toHaveText("6.0001");
    // The chip left with 6.006's prerequisites; focus is in the detail.
    await expect(detailFocus(page)).toBeFocused();
  });

  test("placing the class from the detail does not send focus to the audit", async ({
    page,
  }) => {
    const row = await scrolledRow(page);
    await row.click();
    await cy(page, "addClassFromCardButton").click();
    await expect(cy(page, "classInfoCard")).toBeHidden();
    expect(await focusInAudit(page)).toBe(false);
  });

  test("a detail opened while placement waits still returns focus", async ({
    page,
  }) => {
    // Arm placement from a detail: the detail closes for the canvas.
    await cy(page, "classInSemester1_8_01").click();
    await cy(page, "addClassFromCardButton").click();
    await expect(cy(page, "classInfoCard")).toBeHidden();

    // From the keyboard, since a pointer press on a row cancels placement.
    const row = await scrolledRow(page);
    await row.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "Cancel placing" }),
    ).toBeVisible();
    await cy(page, "closeClassInfoButton").click();
    await expect(cy(page, "classInfoCard")).toBeHidden();
    await expect(row).toBeFocused();
  });

  test("a second card opened over the detail keeps focus on that card", async ({
    page,
  }) => {
    await cy(page, "classInSemester1_8_01").click();
    const next = cy(page, "classInSemester1_18_01");
    await next.click();
    await expect(page.locator(".trail-crumb.current")).toHaveText("18.01");
    await expect(next).toBeFocused();
  });

  test("the keyboard scrolls the detail after a click in it or a keyboard open", async ({
    page,
  }) => {
    // Short enough that the fixture subject's detail overflows its body.
    await page.setViewportSize({ width: 1280, height: 480 });
    const row = await scrolledRow(page);
    const body = detailFocus(page);
    const scrolled = () => body.evaluate((el) => el.scrollTop);

    // The click may scroll the title into view; PageDown must move on.
    await row.click();
    await cy(page, "cardSubjectTitle").click();
    const afterClick = await scrolled();
    await page.keyboard.press("PageDown");
    await expect.poll(scrolled).toBeGreaterThan(afterClick);
    await page.keyboard.press("Escape");

    await row.focus();
    await page.keyboard.press("Enter");
    await expect(body).toBeFocused();
    const afterOpen = await scrolled();
    await page.keyboard.press("PageDown");
    await expect.poll(scrolled).toBeGreaterThan(afterOpen);
  });

  test("leaves focus alone when the student moved on", async ({ page }) => {
    const row = await scrolledRow(page);
    await row.click();
    await expect(detailFocus(page)).toBeFocused();

    // Focus moves to a live control outside the detail; Escape still
    // closes it, and focus stays put.
    const search = page.locator("#searchInputTF");
    await search.focus();
    await page.keyboard.press("Escape");
    await expect(cy(page, "classInfoCard")).toBeHidden();
    await expect(search).toBeFocused();
  });

  test("works with the panel on the right", async ({ page }) => {
    await openSettings(page);
    await cy(page, "panelSideOption-right").click();
    await page.keyboard.press("Escape");

    const audit = cy(page, "audit");
    const canvas = page.locator("#canvasScroll");
    const row = await scrolledRow(page);
    await row.click();
    const detail = cy(page, "classInfoCard");
    await expect(detailFocus(page)).toBeFocused();
    await expect(audit).toHaveAttribute("inert");
    const detailBox = await detail.boundingBox();
    const canvasBox = await canvas.boundingBox();
    expect(detailBox?.x).toBe((await audit.boundingBox())?.x);
    expect(detailBox!.x).toBeGreaterThanOrEqual(
      canvasBox!.x + canvasBox!.width,
    );

    await page.keyboard.press("Escape");
    await expect(row).toBeFocused();
  });
});

test("the detail's enter animation is off under reduced motion", async ({
  context,
  page,
}) => {
  await openTallRoad(context, page);
  const detail = page.locator(".panel-detail");
  const animation = () =>
    detail.evaluate((el) => getComputedStyle(el).animationName);

  await (await scrolledRow(page)).click();
  expect(await animation()).toMatch(/^detail-enter/);
  await page.keyboard.press("Escape");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await (await scrolledRow(page)).click();
  expect(await animation()).toBe("none");
});

test.describe("crossing 860px with the detail open", () => {
  test.beforeEach(async ({ context, page }) => {
    await openTallRoad(context, page);
  });

  test("the audit is never inert in the sheet, and is again on return", async ({
    page,
  }) => {
    const audit = cy(page, "audit");
    const row = await scrolledRow(page);
    await row.click();
    await expect(audit).toHaveAttribute("inert");

    await page.setViewportSize({ width: 800, height: 900 });
    await expect(page.locator(".panel-detail")).toHaveCount(0);
    await expect(cy(page, "classInfoCard")).toBeVisible();
    await expect(audit).not.toHaveAttribute("inert");

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator(".panel-detail")).toBeVisible();
    await expect(audit).toHaveAttribute("inert");
    await expect(detailFocus(page)).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(row).toBeFocused();
  });

  test("a detail opened in the sheet returns focus to the row", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.getByRole("button", { name: "Progress" }).click();
    const row = await scrolledRow(page);
    await row.click();
    await expect(cy(page, "classInfoCard")).toBeVisible();
    await expect(cy(page, "audit")).not.toHaveAttribute("inert");

    await page.keyboard.press("Escape");
    await expect(cy(page, "classInfoCard")).toBeHidden();
    await expect(row).toBeFocused();
  });
});
