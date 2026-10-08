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

  await cy(page, "auditItemmajor18gm.1").click();
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

test("a wrapped row in the chooser never overlaps the row above", async ({
  context,
  page,
}) => {
  await mockFireroad(context);
  // Eight subjects, each "also" filling a long-named requirement, so every
  // row wraps and the list scrolls.
  const ids = [
    "18.01",
    "18.02",
    "8.01",
    "8.02",
    "6.006",
    "6.0001",
    "18.06",
    "6.0002",
  ];
  const longTree = {
    ...tree,
    reqs: [
      {
        title:
          "Required Subjects in the Additional Electrical Engineering and Computer Science Track",
        fulfilled: true,
        percent_fulfilled: 100,
        reqs: ids.map((id) => ({
          req: id,
          sat_courses: [id],
          fulfilled: true,
        })),
      },
      tree.reqs[1],
    ],
  };
  await context.route(
    "https://fireroad.mit.edu/requirements/progress/**",
    (route) => route.fulfill({ json: longTree }),
  );
  await seedReturningVisitor(context);
  await seedLocalRoads(context, {
    $0$: {
      name: "Math",
      coursesOfStudy: ["major18gm"],
      subjects: ids.map((subject_id, i) => ({
        subject_id,
        semester: 1 + (i % 3),
      })),
    },
  });
  await page.goto("/road/$0$");

  await cy(page, "auditItemmajor18gm.1").click();
  await cy(page, "auditItemmajor18gm.1.0").click();
  const rows = cy(page, "chooseSubjects").locator(".petition-course");
  await expect(rows).toHaveCount(ids.length);
  const clipped = await rows.evaluateAll(
    (els) => els.filter((el) => el.scrollHeight > el.clientHeight + 1).length,
  );
  expect(clipped).toBe(0);
});

test("a text-only elective searches its branch's department", async ({
  context,
  page,
}) => {
  await mockFireroad(context);
  const mathTree = {
    ...tree,
    reqs: [
      {
        ...tree.reqs[0],
        reqs: [
          { req: "18.01", sat_courses: [], fulfilled: false },
          { req: "18.02", sat_courses: [], fulfilled: false },
        ],
      },
      tree.reqs[1],
    ],
  };
  await context.route(
    "https://fireroad.mit.edu/requirements/progress/**",
    (route) => route.fulfill({ json: mathTree }),
  );
  await seedReturningVisitor(context);
  await seedLocalRoads(context, {
    $0$: { name: "Math", coursesOfStudy: ["major18gm"], subjects: [] },
  });
  await page.goto("/road/$0$");

  await cy(page, "auditItemmajor18gm.1").click();
  // Row actions show on hover.
  await cy(page, "auditItemmajor18gm.1.0").hover();
  await page
    .getByRole("button", { name: /^Find classes for 6 subjects/ })
    .click();
  await expect(page.locator(".palette-input")).toHaveValue("18.");
});
