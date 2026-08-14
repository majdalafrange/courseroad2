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
    page.getByRole("button", { name: /6-3 Major 50% complete/ }),
  ).toBeVisible();
});
