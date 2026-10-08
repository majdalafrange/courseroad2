import { expect, test, type Page } from "@playwright/test";
import { cy, mockFireroad, seedReturningVisitor } from "./support/app";

// Lazy-chunk recovery, see lib/errorBoundary.ts.
const ROAD_CHUNK = /\/assets\/__road__-[^/]*\.js(\?.*)?$/;

test.beforeEach(async ({ context }) => {
  await mockFireroad(context);
  await seedReturningVisitor(context);
});

// Chromium can request a failing chunk twice in one load, the second time
// after the load event, so the tests count navigations, not requests.
function countLoads(page: Page): () => number {
  let loads = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      loads += 1;
    }
  });
  return () => loads;
}

test("a road chunk that fails to load once recovers with a reload", async ({
  context,
  page,
}) => {
  const loads = countLoads(page);
  await context.route(ROAD_CHUNK, (route) =>
    loads() === 1 ? route.abort("failed") : route.continue(),
  );

  await page.goto("/");
  await page.locator("#canvasScroll").waitFor();

  expect(loads()).toBe(2);
  await expect(cy(page, "roadSwitcher")).toContainText("My First Road");
});

test("a road chunk that keeps failing lands on the error screen, not a loop", async ({
  context,
  page,
}) => {
  const loads = countLoads(page);
  await context.route(ROAD_CHUNK, (route) => route.abort("failed"));

  await page.goto("/");
  // Two loads, each through Chromium's retries of the chunk: past the
  // default 5s on a busy machine.
  await expect(page.getByRole("alert")).toContainText(
    "CourseRoad hit an error",
    { timeout: 15_000 },
  );
  expect(loads()).toBe(2);
});
