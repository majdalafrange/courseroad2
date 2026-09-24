import { expect, test, type Page } from "@playwright/test";
import {
  cy,
  mockFireroad,
  seedLocalRoads,
  seedReturningVisitor,
} from "./support/app";

/**
 * Favorite subjects: starred in the class detail, listed first in the
 * command palette before any search. Logged out here, so favorites live
 * in this browser; the FireRoad sync is covered by
 * tests/unit/stores/favorites.spec.ts.
 */

test.beforeEach(async ({ context, page }) => {
  await mockFireroad(context);
  await seedReturningVisitor(context);
  await seedLocalRoads(context, {
    $0$: {
      name: "Course 6-3",
      coursesOfStudy: ["girs"],
      subjects: [{ subject_id: "18.01", semester: 1 }],
    },
  });
  await page.goto("/road/$0$");
  await page.locator("#canvasScroll").waitFor();
});

async function starFromDetail(page: Page, id: string) {
  await cy(page, `classInSemester1_${id.replace(".", "_")}`)
    .locator(".card-body")
    .click();
  const star = page.getByRole("button", { name: `Favorite ${id}` });
  await star.click();
  return star;
}

async function openPalette(page: Page) {
  await page.keyboard.press("ControlOrMeta+k");
  const input = page.getByRole("combobox", {
    name: "Search classes, filters, and commands",
  });
  await expect(input).toBeFocused();
  return input;
}

test("a starred class is listed first in the palette, before searching", async ({
  page,
}) => {
  const star = await starFromDetail(page, "18.01");
  await expect(star).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");

  await expect(cy(page, "classInfoCard")).toBeHidden();

  const input = await openPalette(page);
  const listbox = page.getByRole("listbox", { name: "Results" });
  // The first group, and its first option, are the favorites.
  await expect(listbox.getByRole("group").first()).toHaveAccessibleName(
    "Favorites",
  );
  await expect(listbox.getByRole("option").first()).toContainText("18.01");

  // Enter opens it, like any class in the palette.
  await page.keyboard.press("Enter");
  await expect(page.locator(".trail-crumb.current")).toHaveText("18.01");
  // The palette finishes closing before the next key; Escape during its
  // exit animation still reaches it, not the detail.
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Typing searches instead: the favorites step aside.
  await page.keyboard.press("Escape");
  await expect(cy(page, "classInfoCard")).toBeHidden();
  await openPalette(page);
  await input.fill("8.0");
  await expect(listbox.getByRole("group", { name: "Favorites" })).toHaveCount(
    0,
  );
});

test("favorites persist across a reload and can be removed", async ({
  page,
}) => {
  await starFromDetail(page, "18.01");
  await page.keyboard.press("Escape");

  await expect(cy(page, "classInfoCard")).toBeHidden();

  await page.reload();
  await page.locator("#canvasScroll").waitFor();
  await openPalette(page);
  const listbox = page.getByRole("listbox", { name: "Results" });
  await expect(listbox.getByRole("group", { name: "Favorites" })).toHaveCount(
    1,
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Unstarring takes it off the list.
  const star = await starFromDetail(page, "18.01");
  await expect(star).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Escape");
  await expect(cy(page, "classInfoCard")).toBeHidden();
  await openPalette(page);
  await expect(listbox.getByRole("group", { name: "Favorites" })).toHaveCount(
    0,
  );
});
