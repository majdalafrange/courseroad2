import { expect, test, type Request } from "@playwright/test";
import {
  cy,
  mockFireroad,
  seedLocalRoads,
  seedReturningVisitor,
} from "./support/app";

/** Trimmed from FireRoad's real 18 (General) progress response. */
const tree = {
  "list-id": "major18gm.reql",
  title: "18 Major (General)",
  "medium-title": "18 Major (General)",
  fulfilled: false,
  percent_fulfilled: 20,
  reqs: [
    {
      title: "Required Subjects",
      fulfilled: true,
      percent_fulfilled: 100,
      reqs: [{ req: "18.01", sat_courses: ["18.01"], fulfilled: true }],
    },
    {
      title: "Restricted Electives",
      fulfilled: false,
      percent_fulfilled: 0,
      reqs: [
        {
          req: "6 subjects (first decimal ≥ 1)",
          "plain-string": true,
          "threshold-desc": "select any 6",
          threshold: { cutoff: 6, criterion: "subjects", type: "GTE" },
          sat_courses: [],
          fulfilled: false,
          percent_fulfilled: 0,
        },
      ],
    },
  ],
};

test("a choose-n requirement counts the subjects picked for it", async ({
  context,
  page,
}) => {
  await mockFireroad(context);
  const progressBodies: unknown[] = [];
  await context.route(
    "https://fireroad.mit.edu/requirements/progress/**",
    (route, request: Request) => {
      progressBodies.push(request.postDataJSON());
      return route.fulfill({ json: tree });
    },
  );
  await seedReturningVisitor(context);
  await seedLocalRoads(context, {
    $0$: {
      name: "Math",
      coursesOfStudy: ["major18gm"],
      subjects: [
        { subject_id: "18.01", semester: 1 },
        { subject_id: "18.02", semester: 3 },
        { subject_id: "6.006", semester: 4 },
      ],
    },
  });
  await page.goto("/road/$0$");

  await cy(page, "auditItemmajor18gm.1.0").click();
  const chooser = cy(page, "chooseSubjects");
  await expect(chooser).toBeVisible();
  // 18.01 already fills a required subject, and the picker says so.
  await expect(
    chooser.getByRole("checkbox", { name: /18\.01.*Required Subjects/ }),
  ).toBeVisible();

  await chooser.getByRole("checkbox", { name: /^18\.02/ }).click();
  await chooser.getByRole("checkbox", { name: /^6\.006/ }).click();
  await expect(page.getByText("2 of 6 chosen")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).first().click();

  // FireRoad receives the choice as the leaf's substitution.
  await expect
    .poll(() =>
      progressBodies.some(
        (body) =>
          JSON.stringify(
            (body as { progressAssertions?: unknown }).progressAssertions,
          ) ===
          JSON.stringify({
            "major18gm.1.0": { substitutions: ["18.02", "6.006"] },
          }),
      ),
    )
    .toBe(true);
  await expect(cy(page, "auditItemmajor18gm.1.0")).toContainText("2/6");
});
