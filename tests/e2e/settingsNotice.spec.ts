import { expect, test } from "@playwright/test";
import { mockFireroad, seedReturningVisitor } from "./support/app";

test("a first open points to Settings once", async ({ context, page }) => {
  await mockFireroad(context);
  await seedReturningVisitor(context);
  // The shared seed marks the notice seen; this visitor has not seen it.
  await context.addInitScript(() => {
    if (sessionStorage.getItem("seeded") === null) {
      localStorage.removeItem("seenSettingsNotice");
      sessionStorage.setItem("seeded", "1");
    }
  });

  await page.goto("/");
  await expect(
    page.locator(".g-toast-message", {
      hasText: "Layout and theme are in Settings",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();

  await page.reload();
  await page.locator("#canvasScroll").waitFor();
  await expect(
    page.locator(".g-toast-message", {
      hasText: "Layout and theme are in Settings",
    }),
  ).toHaveCount(0);
});

test("an old-app user hears why the layout is classic", async ({
  context,
  page,
}) => {
  await mockFireroad(context);
  await seedReturningVisitor(context);
  await context.addInitScript(() => {
    localStorage.removeItem("seenSettingsNotice");
  });
  await context.addCookies([
    { name: "versionNumber", value: "1.0.0", domain: "localhost", path: "/" },
  ]);

  await page.goto("/");
  await expect(
    page.locator(".g-toast-message", {
      hasText: "Your plan uses the classic layout",
    }),
  ).toBeVisible();
});

test("the notice waits for onboarding to close", async ({ context, page }) => {
  await mockFireroad(context);
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Skip" })).toBeVisible();
  await expect(
    page.locator(".g-toast-message", {
      hasText: "Layout and theme are in Settings",
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(
    page.locator(".g-toast-message", {
      hasText: "Layout and theme are in Settings",
    }),
  ).toBeVisible();
});
