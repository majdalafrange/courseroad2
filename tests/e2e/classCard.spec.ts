import { expect, test } from "@playwright/test";
import catalog from "./fixtures/catalog.json" with { type: "json" };
import {
  mockFireroad,
  seedLocalRoads,
  seedReturningVisitor,
} from "./support/app";

test("an old-number subscript leaves the card's title in line", async ({
  context,
  page,
}) => {
  await mockFireroad(context);
  // A renumbered subject: its card shows the old number as a subscript.
  const renumbered = catalog.map((subject, i) =>
    i === 0 ? { ...subject, old_id: "6.042" } : subject,
  );
  await context.route("https://fireroad.mit.edu/courses/all**", (route) =>
    route.fulfill({ json: renumbered }),
  );
  await seedReturningVisitor(context);
  await seedLocalRoads(context, {
    r1: {
      name: "Renumbered",
      coursesOfStudy: ["girs"],
      subjects: [catalog[0], catalog[1]].map((s) => ({
        subject_id: s.subject_id,
        semester: 1,
      })),
    },
  });

  await page.goto("/road");
  const fall = page.locator('[data-cy$="__semester_1"]');
  await expect(fall.locator(".card-old-id")).toHaveText("[6.042]");
  const offsets = await fall
    .locator(".card-title")
    .evaluateAll((titles) =>
      titles.map(
        (title) =>
          title.getBoundingClientRect().top -
          title.closest(".class-card")!.getBoundingClientRect().top,
      ),
    );
  expect(offsets).toHaveLength(2);
  expect(offsets[0]).toBeCloseTo(offsets[1], 0);
});
