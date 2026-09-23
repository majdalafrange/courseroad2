import { expect, test } from "@playwright/test";
import {
  cy,
  mockFireroad,
  seedLocalRoads,
  seedReturningVisitor,
} from "./support/app";

/**
 * Subject notes (double-click a card, or N on it) and the detail panel's
 * back button. Logged out here, so notes live in this browser; the
 * FireRoad sync is covered by tests/unit/stores/notes.spec.ts.
 */

test.beforeEach(async ({ context, page }) => {
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
  });
  await page.goto("/road/$0$");
  await page.locator("#canvasScroll").waitFor();
});

const card = (page: import("@playwright/test").Page) =>
  cy(page, "classInSemester1_8_01").locator(".card-body");

test("double-clicking a card opens its note, not the class", async ({
  page,
}) => {
  await card(page).dblclick();
  const field = page.getByRole("textbox", { name: "Note on 8.01" });
  await expect(field).toBeFocused();
  await field.fill("check prereqs with prof");
  await field.press("Enter");

  await expect(field).toHaveCount(0);
  await expect(card(page)).toHaveAccessibleName(
    /note: check prereqs with prof/,
  );
  await expect(card(page)).toBeFocused();
  // The double-click's first click did not open the class behind it.
  await expect(cy(page, "classInfoCard")).toBeHidden();

  // Kept in this browser while logged out, so it survives a reload.
  await page.reload();
  await expect(card(page)).toHaveAccessibleName(
    /note: check prereqs with prof/,
  );
});

test("a single click still opens the class, and shows its note", async ({
  page,
}) => {
  await card(page).focus();
  await page.keyboard.press("n");
  const field = page.getByRole("textbox", { name: "Note on 8.01" });
  await field.fill("ask about the lab");
  await page.getByRole("button", { name: "Done" }).click();

  await card(page).click();
  await expect(cy(page, "classInfoCard")).toBeVisible();
  await expect(page.locator(".detail-own-note")).toContainText(
    "ask about the lab",
  );
});

test("a note can be removed, and undo brings it back", async ({ page }) => {
  await card(page).focus();
  await page.keyboard.press("n");
  await page.getByRole("textbox", { name: "Note on 8.01" }).fill("temp");
  await page.keyboard.press("Enter");
  await expect(card(page)).toHaveAccessibleName(/note: temp/);

  await card(page).dblclick();
  await page.getByRole("button", { name: "Remove note" }).click();
  await expect(card(page)).not.toHaveAccessibleName(/note:/);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(card(page)).toHaveAccessibleName(/note: temp/);
});

test("the detail panel's back button returns to the previous class", async ({
  page,
}) => {
  await cy(page, "classInSemester1_18_01").locator(".card-body").click();
  const detail = cy(page, "classInfoCard");
  await expect(detail).toBeVisible();
  // No history yet: back and forward are there but disabled.
  await expect(cy(page, "classInfoBackButton")).toBeDisabled();
  await expect(cy(page, "classInfoForwardButton")).toBeDisabled();

  const next = detail.locator(".subject-chip, .prereq-chip").first();
  const nextId = (await next.textContent())?.trim();
  await next.click();
  await expect(page.locator(".trail-crumb.current")).toHaveText(nextId ?? "");

  const back = page.getByRole("button", { name: "Back to 18.01" });
  await back.click();
  await expect(page.locator(".trail-crumb.current")).toHaveText("18.01");

  // And forward again, to where we came from.
  await page.getByRole("button", { name: `Forward to ${nextId}` }).click();
  await expect(page.locator(".trail-crumb.current")).toHaveText(nextId ?? "");
  await expect(cy(page, "classInfoForwardButton")).toBeDisabled();
  await expect(cy(page, "classInfoForwardButton")).toHaveAccessibleName(
    "Forward",
  );
});
