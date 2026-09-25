import { expect, test } from "@playwright/test";
import { openApp } from "./support/app";

test.beforeEach(async ({ context, page }) => {
  await openApp(context, page);
});

test("adding a program shows its audit progress", async ({ page }) => {
  await page
    .getByRole("button", { name: /Add a major or minor|Pick your majors/ })
    .click();
  await page.locator('[data-cy="addProgrammajor6-3"]').click();
  await expect(
    page.getByRole("button", {
      name: "6-3 Major Computer Science and Engineering 50% complete",
    }),
  ).toBeVisible();
});

test("a program whose percent is N/A keeps a full-height header", async ({
  context,
  page,
}) => {
  // 6-3 reads N/A; 18 reads a number. Both titles fit on one line.
  await context.route(
    "https://fireroad.mit.edu/requirements/progress/**",
    (route) =>
      route.fulfill({
        json: {
          percent_fulfilled: route.request().url().includes("major6-3")
            ? "N/A"
            : 40,
          fulfilled: false,
          reqs: [],
        },
      }),
  );
  for (const key of ["major6-3", "minor18"]) {
    await page
      .getByRole("button", { name: /Add a major or minor|Pick your majors/ })
      .click();
    await page.locator(`[data-cy="addProgram${key}"]`).click();
  }

  // No percent and no "Computing..." for N/A, and no shorter header.
  const subs = page.locator(".program-sub");
  await expect(subs).toHaveText(["50% complete", "", "40% complete"]);
  const heads = page.locator(".program-head");
  expect((await heads.nth(1).boundingBox())?.height).toBe(
    (await heads.nth(2).boundingBox())?.height,
  );
});
