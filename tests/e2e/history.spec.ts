import { expect, test, type Page } from "@playwright/test";
import {
  cy,
  mockFireroad,
  seedLocalRoads,
  seedReturningVisitor,
} from "./support/app";

/** The URL's path after the app origin, decoded for readable asserts. */
function appPath(page: Page): string {
  const url = new URL(page.url());
  return decodeURIComponent(url.pathname) + url.search;
}

async function waitForCanvas(page: Page): Promise<void> {
  await cy(page, "roadSwitcher").waitFor();
  await page.locator("#canvasScroll").waitFor();
}

test.beforeEach(async ({ context }) => {
  await mockFireroad(context);
  await seedReturningVisitor(context);
  await seedLocalRoads(context, {
    $1$: { name: "Road One", coursesOfStudy: ["girs"], subjects: [] },
    $2$: { name: "Road Two", coursesOfStudy: ["girs"], subjects: [] },
  });
});

test("opening /road fills in the road without a second history entry", async ({
  page,
}) => {
  await page.goto("about:blank");
  await page.goto("/road");
  await waitForCanvas(page);
  await expect.poll(() => appPath(page)).toMatch(/^\/road\/.+/);

  await page.goBack();
  await expect.poll(() => page.url()).toBe("about:blank");
});

test("the header logo keeps the road in the URL", async ({ page }) => {
  await page.goto("/road/$2$");
  await waitForCanvas(page);
  await page.getByRole("link", { name: "CourseRoad home" }).click();
  await expect.poll(() => appPath(page)).toBe("/road/$2$");
});

test("Back after switching roads shows the previous road", async ({ page }) => {
  await page.goto("/road/$1$");
  await waitForCanvas(page);
  await cy(page, "roadSwitcher").click();
  await cy(page, "roadTab$2$").click();
  await expect.poll(() => appPath(page)).toBe("/road/$2$");
  await expect(cy(page, "roadSwitcher")).toContainText("Road Two");

  await page.goBack();
  await expect.poll(() => appPath(page)).toBe("/road/$1$");
  await expect(cy(page, "roadSwitcher")).toContainText("Road One");
});

test("a logged-in road picked by the server replaces the URL", async ({
  context,
  page,
}) => {
  const file = {
    name: "Cloud Road",
    agent: "",
    changed: "2026-08-01T00:00:00.000Z",
  };
  // Registered after mockFireroad, so these win for the paths they match.
  await context.route("https://fireroad.mit.edu/verify/", (route) =>
    route.fulfill({ json: { success: true, current_semester: 3 } }),
  );
  await context.route("https://fireroad.mit.edu/sync/roads/**", (route) =>
    route.request().url().includes("?id=")
      ? route.fulfill({
          json: {
            success: true,
            file: {
              ...file,
              downloaded: file.changed,
              contents: {
                coursesOfStudy: ["girs"],
                selectedSubjects: [],
                progressOverrides: {},
                progressAssertions: {},
              },
            },
          },
        })
      : route.fulfill({ json: { success: true, files: { 101: file } } }),
  );
  await context.addInitScript(() => {
    localStorage.setItem(
      "accessInfo",
      JSON.stringify({
        v: { access_token: "t", academic_id: "a@mit.edu" },
        e: 0,
      }),
    );
    localStorage.removeItem("newRoads");
  });

  await page.goto("about:blank");
  await page.goto("/road");
  await waitForCanvas(page);
  await expect(cy(page, "roadSwitcher")).toContainText("Cloud Road");
  await expect.poll(() => appPath(page)).toBe("/road/101");

  await page.goBack();
  await expect.poll(() => page.url()).toBe("about:blank");
});

test("opening Explore with a starting class keeps it", async ({ page }) => {
  await page.goto("/explore/$1$?from=6.1210");
  await page.locator("#exploreMain").waitFor();
  await expect.poll(() => appPath(page)).toBe("/explore/$1$?from=6.1210");
});
