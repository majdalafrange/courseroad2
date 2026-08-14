import { expect, test } from "@playwright/test";
import {
  cy,
  mockFireroad,
  seedLocalRoads,
  seedReturningVisitor,
} from "./support/app";

test("first visit: consent, onboarding, then the shell", async ({
  context,
  page,
}) => {
  await mockFireroad(context);
  await page.goto("/");

  // A fresh, logged-out visitor gets the first-run wizard, whose scrim
  // covers the shell; Skip is always in reach.
  await page.getByRole("button", { name: "Skip" }).click();

  // The consent banner is the only thing that grants storage.
  await cy(page, "acceptCookies").click();

  await expect(cy(page, "roadSwitcher")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Pick your majors|Add a major or minor/ }),
  ).toBeVisible();
  await expect(page.locator('[data-cy$="__semester_1"]')).toBeVisible();
});

test("skipping onboarding sticks across reloads, consent answered or not", async ({
  context,
  page,
}) => {
  await mockFireroad(context);
  await page.goto("/");
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(cy(page, "roadSwitcher")).toBeVisible();

  // First reload with the consent banner still unanswered: on a true
  // first run the banner sits behind the wizard's scrim, so the
  // dismissal must not depend on it.
  await page.reload();
  await cy(page, "roadSwitcher").waitFor();
  await expect(page.getByRole("button", { name: "Skip" })).toHaveCount(0);

  // Now answer consent and reload again: the first consented boot stamps
  // the version number and must not wipe the dismissal while doing so.
  await cy(page, "acceptCookies").click();
  await page.reload();
  await cy(page, "roadSwitcher").waitFor();
  await expect(page.getByRole("button", { name: "Skip" })).toHaveCount(0);
});

test("a persisted road's audit computes on load (one request per program)", async ({
  context,
  page,
}) => {
  await mockFireroad(context);
  await seedReturningVisitor(context);
  await seedLocalRoads(context, {
    $0$: {
      name: "Course 6-3",
      coursesOfStudy: ["girs", "major6-3"],
      subjects: [{ subject_id: "8.01", semester: 1 }],
    },
  });

  const progressBodies = new Map<string, string[]>();
  page.on("request", (request) => {
    const match = /requirements\/progress\/([^/]+)\//.exec(request.url());
    if (match !== null) {
      const body = request.postDataJSON() as {
        selectedSubjects: { subject_id: string }[];
      };
      progressBodies.set(
        decodeURIComponent(match[1]),
        body.selectedSubjects.map((s) => s.subject_id),
      );
    }
  });

  await page.goto("/");
  await cy(page, "roadSwitcher").waitFor();

  // Every program on the road is scored, against the road's actual
  // contents rather than an empty default road.
  await expect
    .poll(() => [...progressBodies.keys()].sort())
    .toEqual(["girs", "major6-3"]);
  expect(progressBodies.get("girs")).toContain("8.01");
  expect(progressBodies.get("major6-3")).toContain("8.01");
  // MainPage's data-cy="audit" overrides the panel's own hook.
  await expect(cy(page, "audit")).toContainText("% complete");
  await expect(cy(page, "audit")).not.toContainText("computing…");
});

test("an unknown road id rewrites the URL to the road actually shown", async ({
  context,
  page,
}) => {
  await mockFireroad(context);
  await seedReturningVisitor(context);
  await seedLocalRoads(context, {
    $0$: {
      name: "Course 6-3",
      coursesOfStudy: ["girs"],
      subjects: [{ subject_id: "8.01", semester: 1 }],
    },
  });
  await page.goto("/road/DOESNOTEXIST");
  await cy(page, "roadSwitcher").waitFor();
  await expect(cy(page, "roadSwitcher")).toContainText("Course 6-3");
  await expect
    .poll(() => decodeURIComponent(page.url()))
    .toContain("/road/$0$");
});
