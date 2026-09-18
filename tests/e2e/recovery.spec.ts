import { expect, test } from "@playwright/test";
import { cy, mockFireroad, seedReturningVisitor } from "./support/app";

// Lazy-chunk recovery, see lib/errorBoundary.ts.
const ROAD_CHUNK = /\/assets\/__road__-[^/]*\.js(\?.*)?$/;

test.beforeEach(async ({ context }) => {
  await mockFireroad(context);
  await seedReturningVisitor(context);
});

test("a road chunk that fails to load once recovers with a reload", async ({
  context,
  page,
}) => {
  let aborted = 0;
  await context.route(ROAD_CHUNK, (route) => {
    if (aborted === 0) {
      aborted += 1;
      return route.abort("failed");
    }
    return route.continue();
  });

  await page.goto("/");
  await page.locator("#canvasScroll").waitFor();

  expect(aborted).toBe(1);
  await expect(cy(page, "roadSwitcher")).toContainText("My First Road");
});

test("a road chunk that keeps failing lands on the error screen, not a loop", async ({
  context,
  page,
}) => {
  let aborted = 0;
  await context.route(ROAD_CHUNK, (route) => {
    aborted += 1;
    return route.abort("failed");
  });

  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "CourseRoad hit an error",
  );
  expect(aborted).toBe(2);
});
