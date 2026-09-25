import { expect, test } from "@playwright/test";
import { cy, mockFireroad, seedReturningVisitor } from "./support/app";

/** The old CourseRoad shares this origin: path=/ cookies, and it loads
 *  localStorage "courseRoadStore" as its whole state. */
const oldSnapshot = JSON.stringify({
  loggedIn: true,
  roads: { "123": { name: "Main road", contents: {} } },
  subjectsInfo: [],
});

test("leaves the old app's cookies and snapshot alone", async ({
  context,
  page,
}) => {
  await mockFireroad(context);
  await seedReturningVisitor(context);
  await context.addCookies(
    ["newRoads", "accessInfo", "versionNumber"].map((name) => ({
      name,
      value: name === "versionNumber" ? "1.0.0" : "%7B%7D",
      domain: "localhost",
      path: "/",
    })),
  );
  await context.addInitScript((snapshot) => {
    if (sessionStorage.getItem("seeded") === null) {
      localStorage.setItem("courseRoadStore", snapshot);
      sessionStorage.setItem("seeded", "1");
    }
  }, oldSnapshot);

  await page.goto("/");
  await page.locator("#canvasScroll").waitFor();
  // A settings write lands in this app's own snapshot.
  await page.getByRole("button", { name: "More", exact: true }).click();
  await cy(page, "settingsButton").click();
  await cy(page, "panelSideOption-right").click();
  await page.reload();
  await page.locator("#canvasScroll").waitFor();

  const cookies = (await context.cookies()).map((c) => c.name);
  expect(cookies).toEqual(
    expect.arrayContaining(["newRoads", "accessInfo", "versionNumber"]),
  );
  const stored = await page.evaluate(() => ({
    legacy: localStorage.getItem("courseRoadStore"),
    own: localStorage.getItem("courseRoadState"),
  }));
  expect(stored.legacy).toBe(oldSnapshot);
  expect(JSON.parse(stored.own ?? "{}").panelSide).toBe("right");
});

test("moves a snapshot an earlier /dev build left on the old app's key", async ({
  context,
  page,
}) => {
  await mockFireroad(context);
  await seedReturningVisitor(context);
  await context.addInitScript(() => {
    if (sessionStorage.getItem("seeded") === null) {
      localStorage.setItem(
        "courseRoadStore",
        JSON.stringify({ currentSemester: 1, themeMode: "dark" }),
      );
      sessionStorage.setItem("seeded", "1");
    }
  });

  await page.goto("/");
  await page.locator("#canvasScroll").waitFor();

  const stored = await page.evaluate(() => ({
    legacy: localStorage.getItem("courseRoadStore"),
    theme: document.documentElement.dataset.theme,
  }));
  expect(stored.legacy).toBeNull();
  // Its settings carried over.
  expect(stored.theme).toBe("dark");
});
