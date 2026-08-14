import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useConnectionsStore } from "../../../src/stores/connections";
import { useCourseDataStore } from "../../../src/stores/courseData";
import { makeCatalog, makeSubject } from "../lib/fixtures";

/**
 * An exploration is stored per tab, but only once the student has actually
 * said yes. Consent must be granted, not merely unrefused: leaving the
 * banner alone is not an answer, so nothing is written until it is.
 */
function loadCatalog() {
  const courseData = useCourseDataStore();
  const catalog = makeCatalog([
    makeSubject({ subject_id: "1.001" }),
    makeSubject({ subject_id: "2.002", prerequisites: "1.001" }),
  ]);
  courseData.subjectsInfo = catalog.subjectsInfo;
  courseData.subjectsIndex = catalog.subjectsIndex;
  return courseData;
}

beforeEach(() => {
  setActivePinia(createPinia());
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

describe("connections store: storage consent", () => {
  it("stores nothing while the banner is unanswered", () => {
    const courseData = loadCatalog();
    expect(courseData.cookiesAllowed).toBeUndefined();

    useConnectionsStore().seedFrom("1.001");

    expect(sessionStorage.length).toBe(0);
  });

  it("stores nothing after opting out", () => {
    const courseData = loadCatalog();
    courseData.disallowCookies();

    useConnectionsStore().seedFrom("1.001");

    expect(sessionStorage.length).toBe(0);
  });

  it("stores the exploration once consent is granted", () => {
    const courseData = loadCatalog();
    courseData.allowCookies();

    useConnectionsStore().seedFrom("1.001");

    expect(sessionStorage.getItem("connectionsExploration")).not.toBeNull();
  });

  it("keeps working without storage: the exploration is still explorable", () => {
    const courseData = loadCatalog();
    courseData.disallowCookies();
    const store = useConnectionsStore();

    store.seedFrom("1.001");

    // Consent gates persistence, never the feature itself.
    expect(store.nodes.length).toBeGreaterThan(0);
  });
});
