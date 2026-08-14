import { describe, expect, it } from "vitest";
import {
  semesterWarnings,
  subjectWarnings,
  type WarningContext,
} from "../../../src/lib/warnings";
import {
  SUBJECTS,
  emptyBuckets,
  makeCatalog,
  makeSubject,
  placed,
} from "./fixtures";

const catalog = makeCatalog();

function ctx(partial: Partial<WarningContext> = {}): WarningContext {
  return {
    catalog,
    selectedSubjects: emptyBuckets(),
    index: 1,
    baseYear: 2027,
    scheduledSemesterIndex: -99,
    now: new Date(2026, 2, 1),
    ...partial,
  };
}

describe("subjectWarnings", () => {
  it("flags unsatisfied prerequisites", () => {
    const buckets = emptyBuckets();
    buckets[2].push(placed("6.0002", 2)); // needs 6.0001 earlier
    const warnings = subjectWarnings(
      buckets[2][0],
      ctx({ selectedSubjects: buckets, index: 2 }),
    );
    expect(warnings.some((w) => w.includes("Unsatisfied prerequisite"))).toBe(
      true,
    );
  });

  it("names the missing prerequisite ids in the warning", () => {
    const buckets = emptyBuckets();
    buckets[2].push(placed("6.006", 2));
    // prereqs: (6.0001/6.00/6.01), (6.042/6.1200/18.062), nothing placed
    const warnings = subjectWarnings(
      buckets[2][0],
      ctx({ selectedSubjects: buckets, index: 2 }),
    );
    const warning = warnings.find((w) =>
      w.includes("Unsatisfied prerequisite"),
    );
    expect(warning).toBeDefined();
    // one id per any-group, chosen deterministically (lexicographic tie)
    expect(warning).toContain("Missing 6.00, 18.062.");
  });

  it("names only the unmet group once part of the prereqs is satisfied", () => {
    const buckets = emptyBuckets();
    buckets[1].push(placed("6.0001", 1));
    buckets[2].push(placed("6.006", 2));
    const warnings = subjectWarnings(
      buckets[2][0],
      ctx({ selectedSubjects: buckets, index: 2 }),
    );
    const warning = warnings.find((w) =>
      w.includes("Unsatisfied prerequisite"),
    );
    expect(warning).toBeDefined();
    expect(warning).toContain("Missing 18.062.");
    expect(warning).not.toContain("6.0001");
  });

  it("lists at most four missing ids, then + more", () => {
    const needy = makeSubject({
      subject_id: "NEEDY.100",
      prerequisites: "8.01,18.01,6.0001,6.042,21M.301",
    });
    const catalogWithNeedy = makeCatalog([...SUBJECTS, needy]);
    const buckets = emptyBuckets();
    buckets[2].push(placed("NEEDY.100", 2));
    const warnings = subjectWarnings(
      buckets[2][0],
      ctx({ catalog: catalogWithNeedy, selectedSubjects: buckets, index: 2 }),
    );
    const warning = warnings.find((w) =>
      w.includes("Unsatisfied prerequisite"),
    );
    expect(warning).toContain("Missing 8.01, 18.01, 6.0001, 6.042 + more.");
    expect(warning).not.toContain("21M.301");
  });

  it("escapes missing prerequisite ids (v-html invariant)", () => {
    const payload = "<b onmouseover=alert1>";
    const evil = makeSubject({
      subject_id: "EVIL.103",
      prerequisites: `EVIL${payload}.9`,
    });
    const catalogWithEvil = makeCatalog([...SUBJECTS, evil]);
    const buckets = emptyBuckets();
    buckets[2].push(placed("EVIL.103", 2));
    const warnings = subjectWarnings(
      buckets[2][0],
      ctx({ catalog: catalogWithEvil, selectedSubjects: buckets, index: 2 }),
    );
    const warning = warnings.find((w) =>
      w.includes("Unsatisfied prerequisite"),
    );
    expect(warning).toBeDefined();
    expect(warning).not.toContain(payload);
    expect(warning).toContain("&lt;b");
  });

  it("clears prereq warnings when satisfied in an earlier bucket", () => {
    const buckets = emptyBuckets();
    buckets[1].push(placed("6.0001", 1));
    buckets[3].push(placed("6.0002", 3));
    const warnings = subjectWarnings(
      buckets[3][0],
      ctx({ selectedSubjects: buckets, index: 3 }),
    );
    expect(warnings.some((w) => w.includes("Unsatisfied"))).toBe(false);
  });

  it("is quarter-aware: 6.0001 (Q1) satisfies 6.0002 (Q2) same semester", () => {
    const buckets = emptyBuckets();
    buckets[1].push(placed("6.0001", 1), placed("6.0002", 1));
    const warnings = subjectWarnings(
      buckets[1][1],
      ctx({ selectedSubjects: buckets, index: 1 }),
    );
    expect(warnings.some((w) => w.includes("Unsatisfied"))).toBe(false);
  });

  it("flags subjects not offered in the term's season", () => {
    const buckets = emptyBuckets();
    buckets[2].push(placed("8.01", 2)); // 8.01 not offered IAP
    const warnings = subjectWarnings(
      buckets[2][0],
      ctx({ selectedSubjects: buckets, index: 2 }),
    );
    expect(warnings.some((w) => w.includes("not usually offered in IAP"))).toBe(
      true,
    );
  });

  it("flags no-longer-offered subjects with their last offering", () => {
    const buckets = emptyBuckets();
    buckets[7].push(placed("5.111", 7)); // historical, fall-2023
    const warnings = subjectWarnings(
      buckets[7][0],
      ctx({ selectedSubjects: buckets, index: 7, baseYear: 2023 }),
    );
    expect(warnings.some((w) => w.includes("no longer offered"))).toBe(true);
    expect(warnings.some((w) => w.includes("fall 2023"))).toBe(true);
  });

  it("suppresses warnings for custom activities", () => {
    const buckets = emptyBuckets();
    buckets[2].push(placed("MYJOB", 2, { public: false }));
    expect(
      subjectWarnings(
        buckets[2][0],
        ctx({ selectedSubjects: buckets, index: 2 }),
      ),
    ).toEqual([]);
  });

  it("warns about missing schedules in the registration semester", () => {
    const buckets = emptyBuckets();
    buckets[1].push(placed("8.01", 1)); // no schedule field in fixture
    const warnings = subjectWarnings(
      buckets[1][0],
      ctx({
        selectedSubjects: buckets,
        index: 1,
        scheduledSemesterIndex: 1,
        now: new Date(2026, 5, 20), // past fall cutoff
      }),
    );
    expect(warnings.some((w) => w.includes("No schedule"))).toBe(true);
  });
});

describe("semesterWarnings", () => {
  it("returns one warning list per subject in bucket order", () => {
    const buckets = emptyBuckets();
    buckets[1].push(placed("8.01", 1), placed("6.0002", 1));
    const all = semesterWarnings(ctx({ selectedSubjects: buckets, index: 1 }));
    expect(all).toHaveLength(2);
    expect(all[0]).toEqual([]);
    expect(all[1].length).toBeGreaterThan(0);
  });
});

describe("warning HTML escaping (v-html invariant)", () => {
  // Warnings render via v-html in ClassCard, so every catalog field that
  // reaches a warning string must arrive escaped.
  const payload = '<img src=x onerror="alert(1)">';

  it("escapes not_offered_year", () => {
    const evil = makeSubject({
      subject_id: "EVIL.100",
      not_offered_year: `2026${payload}`,
    });
    const catalogWithEvil = makeCatalog([...SUBJECTS, evil]);
    const buckets = emptyBuckets();
    buckets[1].push(placed("EVIL.100", 1));
    const warnings = subjectWarnings(
      buckets[1][0],
      ctx({ catalog: catalogWithEvil, selectedSubjects: buckets, index: 1 }),
    );
    const notOffered = warnings.find((w) => w.includes("Not offered"));
    expect(notOffered).toBeDefined();
    expect(notOffered).not.toContain(payload);
    expect(notOffered).toContain("&lt;img");
  });

  it("escapes source_semester for historical subjects", () => {
    const evil = makeSubject({
      subject_id: "EVIL.101",
      is_historical: true,
      source_semester: `fall-1990${payload}`,
    });
    const catalogWithEvil = makeCatalog([...SUBJECTS, evil]);
    const buckets = emptyBuckets();
    buckets[1].push(placed("EVIL.101", 1));
    const warnings = subjectWarnings(
      buckets[1][0],
      ctx({ catalog: catalogWithEvil, selectedSubjects: buckets, index: 1 }),
    );
    const notOffered = warnings.find((w) => w.includes("no longer offered"));
    expect(notOffered).toBeDefined();
    expect(notOffered).not.toContain(payload);
    expect(notOffered).toContain("&lt;img");
  });

  it("escapes the subject id in season warnings", () => {
    const evil = makeSubject({
      subject_id: `EVIL${payload}.102`,
      offered_fall: false,
      offered_spring: true,
    });
    const catalogWithEvil = makeCatalog([...SUBJECTS, evil]);
    const buckets = emptyBuckets();
    buckets[1].push(placed(`EVIL${payload}.102`, 1)); // bucket 1 is Fall
    const warnings = subjectWarnings(
      buckets[1][0],
      ctx({ catalog: catalogWithEvil, selectedSubjects: buckets, index: 1 }),
    );
    const notOffered = warnings.find((w) => w.includes("not usually offered"));
    expect(notOffered).toBeDefined();
    expect(notOffered).not.toContain(payload);
    expect(notOffered).toContain("&lt;img");
  });
});

describe("corequisites", () => {
  // 8.02 (coreq GIR:CAL2) and 20.110 (either_prereq_or_coreq) cover the
  // two warning kinds that only fire on the corequisite fields. Buckets 1
  // and 3 are Fall and Spring, so no season warning muddies the asserts.
  it("warns when a corequisite is missing", () => {
    const buckets = emptyBuckets();
    buckets[1].push(placed("8.01", 1));
    buckets[3].push(placed("8.02", 3));
    expect(
      subjectWarnings(
        buckets[3][0],
        ctx({ selectedSubjects: buckets, index: 3 }),
      ),
    ).toEqual([
      "<b>Unsatisfied corequisite</b>: One or more corequisites are not yet fulfilled.",
    ]);
  });

  it("accepts a corequisite placed in the same bucket", () => {
    const buckets = emptyBuckets();
    buckets[1].push(placed("8.01", 1));
    buckets[3].push(placed("8.02", 3), placed("18.02", 3));
    expect(
      subjectWarnings(
        buckets[3][0],
        ctx({ selectedSubjects: buckets, index: 3 }),
      ),
    ).toEqual([]);
  });

  it("accepts a corequisite placed in an earlier bucket", () => {
    const buckets = emptyBuckets();
    buckets[1].push(placed("8.01", 1), placed("18.02", 1));
    buckets[3].push(placed("8.02", 3));
    expect(
      subjectWarnings(
        buckets[3][0],
        ctx({ selectedSubjects: buckets, index: 3 }),
      ),
    ).toEqual([]);
  });

  it("either_prereq_or_coreq passes on the prerequisite alone", () => {
    const buckets = emptyBuckets();
    buckets[1].push(placed("8.01", 1));
    buckets[3].push(placed("20.110", 3));
    expect(
      subjectWarnings(
        buckets[3][0],
        ctx({ selectedSubjects: buckets, index: 3 }),
      ),
    ).toEqual([]);
  });

  it("either_prereq_or_coreq passes on the corequisite alone", () => {
    const buckets = emptyBuckets();
    buckets[3].push(placed("20.110", 3), placed("18.02", 3));
    expect(
      subjectWarnings(
        buckets[3][0],
        ctx({ selectedSubjects: buckets, index: 3 }),
      ),
    ).toEqual([]);
  });

  it("either_prereq_or_coreq warns once when neither is satisfied", () => {
    const buckets = emptyBuckets();
    buckets[3].push(placed("20.110", 3));
    expect(
      subjectWarnings(
        buckets[3][0],
        ctx({ selectedSubjects: buckets, index: 3 }),
      ),
    ).toEqual([
      "<b>Unsatisfied corequisite or prerequisite</b>: You must satisfy either the prerequisites or corequisites for this subject.",
    ]);
  });
});
