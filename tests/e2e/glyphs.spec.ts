import { expect, test, type Page } from "@playwright/test";
import {
  cy,
  mockFireroad,
  openApp,
  seedLocalRoads,
  seedReturningVisitor,
} from "./support/app";

/**
 * The glyph field must span the canvas's full scrollable area, padding
 * included. It used to cover only the content box, leaving a bare frame
 * where the page background showed through at every edge.
 */

/** Field geometry relative to the canvas's own scroll space. */
function fieldMetrics(page: Page) {
  return page.evaluate(() => {
    const canvas = document.getElementById("canvasScroll")!;
    const field = canvas.querySelector(".glyph-field")!;
    const canvasRect = canvas.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();
    return {
      top: fieldRect.top - canvasRect.top + canvas.scrollTop,
      left: fieldRect.left - canvasRect.left,
      width: Math.round(fieldRect.width),
      height: Math.round(fieldRect.height),
      clientWidth: canvas.clientWidth,
      scrollHeight: canvas.scrollHeight,
    };
  });
}

async function expectFullCoverage(page: Page) {
  const m = await fieldMetrics(page);
  expect(Math.round(m.top)).toBe(0);
  expect(Math.round(m.left)).toBe(0);
  expect(m.width).toBe(m.clientWidth);
  expect(m.height).toBe(m.scrollHeight);
}

/** A road big enough that the canvas scrolls for several screens. */
function longRoad() {
  const subjects: { subject_id: string; semester: number }[] = [];
  for (let semester = 1; semester <= 15; semester++) {
    for (const id of ["8.01", "18.01", "18.02", "6.006", "8.02", "6.0001"]) {
      subjects.push({ subject_id: id, semester });
    }
  }
  return {
    $0$: { name: "Long", coursesOfStudy: ["girs"], subjects },
  };
}

test("the field covers a short road's canvas, padding included", async ({
  context,
  page,
}) => {
  await openApp(context, page);
  await expectFullCoverage(page);
});

test("the field covers a long road's full scroll extent", async ({
  context,
  page,
}) => {
  await mockFireroad(context);
  await seedReturningVisitor(context);
  await seedLocalRoads(context, longRoad());
  await page.goto("/");
  await cy(page, "roadSwitcher").waitFor();
  await page.locator("#canvasScroll").waitFor();
  const metrics = await fieldMetrics(page);
  expect(metrics.scrollHeight).toBeGreaterThan(1500);
  await expectFullCoverage(page);
});

test.describe("narrow viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the field still reaches every edge at 375px", async ({
    context,
    page,
  }) => {
    await mockFireroad(context);
    await seedReturningVisitor(context);
    await seedLocalRoads(context, longRoad());
    await page.goto("/");
    await cy(page, "roadSwitcher").waitFor();
    await page.locator("#canvasScroll").waitFor();
    await expectFullCoverage(page);
  });
});
