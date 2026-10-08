import { expect, test, type Page } from "@playwright/test";
import {
  cy,
  mockFireroad,
  seedLocalRoads,
  seedReturningVisitor,
} from "./support/app";

test.beforeEach(async ({ context }) => {
  await mockFireroad(context);
  await seedReturningVisitor(context);
  await seedLocalRoads(context, {
    $0$: {
      name: "Intro",
      coursesOfStudy: ["girs"],
      subjects: [
        { subject_id: "6.0001", semester: 1 },
        { subject_id: "6.0002", semester: 3 },
        { subject_id: "21M.301", semester: 3 },
      ],
    },
  });
});

const card = (page: Page, id: string) =>
  cy(
    page,
    `classInSemester${id.startsWith("6.0001") ? 1 : 3}_${id.replace(".", "_")}`,
  );

async function choose(page: Page, mode: string) {
  await page.getByRole("button", { name: "More", exact: true }).click();
  await cy(page, "settingsButton").click();
  await cy(page, `prereqHighlightOption-${mode}`).click();
  await page.keyboard.press("Escape");
}

test("hovering a class lights its prerequisites by default", async ({
  page,
}) => {
  await page.goto("/road/$0$");
  await card(page, "6.0002").hover();
  await expect(card(page, "6.0001")).toHaveClass(/is-ancestor/);
  await expect(card(page, "21M.301")).toHaveClass(/is-dimmed/);
});

test("off: hovering lights nothing", async ({ page }) => {
  await page.goto("/road/$0$");
  await choose(page, "off");
  await card(page, "6.0002").hover();
  await page.waitForTimeout(300);
  await expect(card(page, "6.0001")).not.toHaveClass(/is-ancestor/);
  await expect(card(page, "21M.301")).not.toHaveClass(/is-dimmed/);
});

test("open class: the class in the detail panel drives it, not hover", async ({
  page,
}) => {
  await page.goto("/road/$0$");
  await choose(page, "open");
  await card(page, "6.0002").hover();
  await page.waitForTimeout(300);
  await expect(card(page, "6.0001")).not.toHaveClass(/is-ancestor/);

  await card(page, "6.0002").locator(".card-body").click();
  await expect(cy(page, "classInfoCard")).toBeVisible();
  await expect(card(page, "6.0001")).toHaveClass(/is-ancestor/);

  await cy(page, "closeClassInfoButton").click();
  await expect(card(page, "6.0001")).not.toHaveClass(/is-ancestor/);
});

test.describe("on a touch screen", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  test("the open class drives the highlight by default", async ({ page }) => {
    await page.goto("/road/$0$");
    expect(
      await page.evaluate(() => matchMedia("(pointer: coarse)").matches),
    ).toBe(true);
    // A tap is also a hover, so the setting itself shows which mode is on.
    await page.getByRole("button", { name: "More", exact: true }).tap();
    await cy(page, "settingsButton").tap();
    await expect(cy(page, "prereqHighlightOption-open")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByRole("button", { name: "Close" }).tap();

    await card(page, "6.0002").locator(".card-body").tap();
    await expect(cy(page, "classInfoCard")).toBeVisible();
    await expect(card(page, "6.0001")).toHaveClass(/is-ancestor/);
  });
});
