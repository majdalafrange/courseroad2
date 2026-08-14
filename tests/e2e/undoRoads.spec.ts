import { expect, test } from "@playwright/test";
import {
  cy,
  mockFireroad,
  seedLocalRoads,
  seedReturningVisitor,
} from "./support/app";

test("undo of an edit on another road switches to that road first", async ({
  context,
  page,
}) => {
  // Two persisted roads; rename the second, switch to the first, undo.
  // The undo must land in view: back on the second road, name restored,
  // URL following. It must never mutate a road off screen.
  await mockFireroad(context);
  await seedReturningVisitor(context);
  await seedLocalRoads(context, {
    $0$: { name: "Course 6-3", coursesOfStudy: ["girs"], subjects: [] },
    $1$: { name: "RoadB", coursesOfStudy: ["girs"], subjects: [] },
  });
  await page.goto("/road/$1$");
  await cy(page, "roadSwitcher").waitFor();
  await expect(cy(page, "roadSwitcher")).toContainText("RoadB");

  await cy(page, "roadSwitcher").click();
  await page.locator(".road-name", { hasText: "RoadB" }).hover();
  await cy(page, "editRoadButton").last().click({ force: true });
  const rename = cy(page, "renameRoadField");
  await rename.fill("RoadB2");
  await rename.press("Enter");
  await expect(cy(page, "roadSwitcher")).toContainText("RoadB2");

  await cy(page, "roadTab$0$").click();
  await expect(cy(page, "roadSwitcher")).toContainText("Course 6-3");

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(cy(page, "roadSwitcher")).toContainText("RoadB");
  await expect
    .poll(() => decodeURIComponent(page.url()))
    .toContain("/road/$1$");
});

test.describe("coarse pointer", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });

  test("road actions are hit-testable without hover", async ({
    context,
    page,
  }) => {
    // With (hover: none), the per-row actions cannot be revealed by a
    // hover state; they must be visible and receive the tap themselves
    // instead of the tap falling through to the row.
    await mockFireroad(context);
    await seedReturningVisitor(context);
    await seedLocalRoads(context, {
      $0$: { name: "Course 6-3", coursesOfStudy: ["girs"], subjects: [] },
    });
    await page.goto("/");
    await cy(page, "roadSwitcher").waitFor();
    await cy(page, "roadSwitcher").tap();
    await expect(cy(page, "addRoadButton")).toBeVisible();

    await cy(page, "editRoadButton").first().tap();
    await expect(cy(page, "renameRoadField")).toBeVisible();
  });
});
