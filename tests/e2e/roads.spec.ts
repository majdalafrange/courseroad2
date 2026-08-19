import { expect, test, type Page } from "@playwright/test";
import { cy, openApp } from "./support/app";

test.beforeEach(async ({ context, page }) => {
  await openApp(context, page);
});

/** Open the road switcher popover if it is not already open. */
async function openSwitcher(page: Page): Promise<void> {
  if (!(await cy(page, "addRoadButton").isVisible())) {
    await cy(page, "roadSwitcher").click();
  }
  await expect(cy(page, "addRoadButton")).toBeVisible();
}

test("create, rename, and delete a road through the switcher", async ({
  page,
}) => {
  await openSwitcher(page);
  await cy(page, "addRoadButton").click();

  // Creation is immediate, with the rename input open on the new row.
  const rename = cy(page, "renameRoadField");
  await rename.fill("Thesis plan");
  await rename.press("Enter");
  await expect(cy(page, "roadSwitcher")).toContainText("Thesis plan");

  // Let the rename's debounced save settle, then reload so nothing is
  // pending: the deletion below must reach storage on its own, not ride
  // along on an earlier edit's save.
  await expect(page.locator(".save-state")).toContainText(
    "Saved in this browser",
  );
  await page.reload();

  // Deletion is undoable via toast, never a confirmation dialog. The
  // per-row controls reveal on the row's hover state.
  await openSwitcher(page);
  await page.locator(".road-name", { hasText: "Thesis plan" }).hover();
  await cy(page, "deleteRoadButton").last().click({ force: true });
  await expect(cy(page, "roadSwitcher")).not.toContainText("Thesis plan");

  // With no further edits, a reload used to bring the road back (F2).
  await page.reload();
  await openSwitcher(page);
  await expect(cy(page, "roadSwitcher")).toContainText("My First Road");
  await expect(cy(page, "roadSwitcher")).not.toContainText("Thesis plan");
});

test("renaming a road to a name another road holds is explained", async ({
  page,
}) => {
  await openSwitcher(page);
  await cy(page, "addRoadButton").click();
  const rename = cy(page, "renameRoadField");
  // The default road is "My First Road"; taking its name must fail with
  // the same explanation the import dialog gives.
  await rename.fill("My First Road");
  await rename.press("Enter");
  // Reka's Toast also announces this via its own hidden live region, so
  // scope to the visible toast text rather than a page-wide text match.
  await expect(
    page.locator(".g-toast-message", { hasText: "already a road named" }),
  ).toBeVisible();
  await expect(cy(page, "roadSwitcher")).toContainText("Untitled road");
});

test("export produces a parseable flat .road file", async ({ page }) => {
  // Share lives in the header's overflow menu ("More", capital; the
  // audit's "more" expander is a different control).
  await page.getByRole("button", { name: "More", exact: true }).click();
  await cy(page, "shareRoadButton").click();
  const downloadPromise = page.waitForEvent("download");
  await cy(page, "exportRoadFileButton").click();
  const download = await downloadPromise;
  const path = await download.path();
  const { readFileSync } = await import("fs");
  const road = JSON.parse(readFileSync(path, "utf8"));
  expect(road.coursesOfStudy).toEqual(["girs"]);
  expect(Array.isArray(road.selectedSubjects)).toBe(true);
  expect(road.progressAssertions).toEqual({});
});

test("import via paste round-trips into a new road", async ({ page }) => {
  const file = JSON.stringify({
    coursesOfStudy: ["girs"],
    selectedSubjects: [
      { subject_id: "8.01", semester: 1 },
      // A custom activity in the exact shape the app exports; its id is
      // user-chosen and not in the catalog, and it must survive.
      {
        overrideWarnings: false,
        semester: 1,
        title: "Soft Robotics UROP",
        subject_id: "UROP1",
        units: 9,
        in_class_hours: 0,
        out_of_class_hours: 9,
        custom_color: "@4",
        public: false,
        offered_fall: true,
        offered_IAP: true,
        offered_spring: true,
        offered_summer: true,
      },
    ],
    progressOverrides: {},
  });
  await cy(page, "roadSwitcher").click();
  await cy(page, "importRoadButton").click();
  // GInput forwards attrs to its input, so the hook IS the input.
  await cy(page, "importRoadTitle").fill("Imported plan");
  await cy(page, "importRoadText").fill(file);
  await cy(page, "importRoadSubmitButton").click();
  await expect(cy(page, "roadSwitcher")).toContainText("Imported plan");
  await expect(
    page.locator(".term-cell").getByText("8.01").first(),
  ).toBeVisible();
  await expect(
    page.locator(".term-cell").getByText("UROP1").first(),
  ).toBeVisible();
});

test("pasting a road imports it without naming it first", async ({ page }) => {
  // The reported dead end: the paste path filled in no name, so the
  // primary action stayed disabled with nothing on screen saying why.
  const file = JSON.stringify({
    coursesOfStudy: ["girs"],
    selectedSubjects: [{ subject_id: "8.01", semester: 1 }],
    progressOverrides: {},
  });
  await cy(page, "roadSwitcher").click();
  await cy(page, "importRoadButton").click();
  await expect(cy(page, "importRoadTitle")).toHaveValue("Imported road");

  await cy(page, "importRoadText").fill(file);
  await expect(cy(page, "importRoadSubmitButton")).toBeEnabled();
  await cy(page, "importRoadSubmitButton").click();
  await expect(cy(page, "roadSwitcher")).toContainText("Imported road");
  await expect(cy(page, "importRoadText")).toBeHidden();
  await expect(
    page.locator(".term-cell").getByText("8.01").first(),
  ).toBeVisible();
});

test("a disabled import states its reason", async ({ page }) => {
  const file = JSON.stringify({
    coursesOfStudy: ["girs"],
    selectedSubjects: [{ subject_id: "8.01", semester: 1 }],
    progressOverrides: {},
  });
  await cy(page, "roadSwitcher").click();
  await cy(page, "importRoadButton").click();
  await cy(page, "importRoadText").fill(file);

  // Clearing the name is the one way back to the disabled state, and it
  // has to say so rather than leaving an inert button.
  await cy(page, "importRoadTitle").fill("");
  await expect(cy(page, "importRoadSubmitButton")).toBeDisabled();
  await expect(page.getByText("A road name is required.")).toBeVisible();

  // The existing road's name is the other way, with its own reason.
  await cy(page, "importRoadTitle").fill("My First Road");
  await expect(cy(page, "importRoadSubmitButton")).toBeDisabled();
  await expect(
    page.getByText("There's already a road with this name."),
  ).toBeVisible();
});
