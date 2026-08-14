import type { BrowserContext, Locator, Page } from "@playwright/test";
import catalog from "../fixtures/catalog.json" with { type: "json" };
import reqlist from "../fixtures/reqlist.json" with { type: "json" };
import progress from "../fixtures/progress.json" with { type: "json" };

/** Locator for a data-cy hook. */
export function cy(page: Page, name: string): Locator {
  return page.locator(`[data-cy="${name}"]`);
}

/**
 * Intercept every FireRoad endpoint with fixtures and drop analytics.
 * The suite runs with no network and identical catalog data every time.
 */
export async function mockFireroad(context: BrowserContext): Promise<void> {
  await context.route("https://fireroad.mit.edu/**", (route) => {
    const url = route.request().url();
    if (url.includes("/courses/all")) {
      return route.fulfill({ json: catalog });
    }
    if (url.includes("/requirements/list_reqs/")) {
      return route.fulfill({ json: reqlist });
    }
    if (url.includes("/requirements/progress/")) {
      return route.fulfill({ json: progress });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await context.route("https://analytics.mit.edu/**", (route) => route.abort());
}

/**
 * Pre-seed the storage a returning, consented, onboarded visitor holds,
 * in the appStorage entry envelope ({v, e}); versionNumber must match
 * APP_VERSION or boot wipes local state. The consent flow itself is
 * exercised for real in boot.spec.ts, which skips this seed.
 */
export async function seedReturningVisitor(
  context: BrowserContext,
): Promise<void> {
  await context.addInitScript(() => {
    const entry = (v: unknown) => JSON.stringify({ v, e: 0 });
    localStorage.setItem("dismissedCookies", entry("true"));
    localStorage.setItem("versionNumber", entry("1.0.0"));
    localStorage.setItem("hasOnboarded", entry("true"));
  });
}

/**
 * Pre-seed logged-out roads in the appStorage entry envelope, the same
 * map the app's own saveLocal writes under "newRoads". Subjects use the
 * shared catalog fixture's ids.
 */
export async function seedLocalRoads(
  context: BrowserContext,
  roads: Record<
    string,
    {
      name: string;
      coursesOfStudy: string[];
      subjects: { subject_id: string; semester: number }[];
    }
  >,
): Promise<void> {
  await context.addInitScript((roadsIn: typeof roads) => {
    const map: Record<string, unknown> = {};
    for (const [id, road] of Object.entries(roadsIn)) {
      map[id] = {
        downloaded: "2026-08-01T00:00:00.000Z",
        changed: "2026-08-01T00:00:00.000Z",
        name: road.name,
        agent: "",
        contents: {
          coursesOfStudy: road.coursesOfStudy,
          selectedSubjects: road.subjects.map((s) => ({
            subject_id: s.subject_id,
            title: s.subject_id,
            semester: s.semester,
            units: 12,
            overrideWarnings: false,
          })),
          progressOverrides: {},
          progressAssertions: {},
        },
      };
    }
    localStorage.setItem("newRoads", JSON.stringify({ v: map, e: 0 }));
  }, roads);
}

/** Standard setup: mocked network + returning visitor, app loaded. */
export async function openApp(
  context: BrowserContext,
  page: Page,
): Promise<void> {
  await mockFireroad(context);
  await seedReturningVisitor(context);
  await page.goto("/");
  await cy(page, "roadSwitcher").waitFor();
}
