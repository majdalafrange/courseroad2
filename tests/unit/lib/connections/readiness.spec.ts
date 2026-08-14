import { describe, expect, it } from "vitest";
import { createReadinessEvaluator } from "../../../../src/lib/connections/readiness";
import type {
  CatalogView,
  SelectedSubject,
  Subject,
} from "../../../../src/lib/types";
import { getSubject } from "../../../../src/lib/types";
import { emptyBuckets, makeCatalog, makeSubject, placed } from "../fixtures";

const catalog = makeCatalog([
  makeSubject({ subject_id: "6.100", title: "Intro" }),
  makeSubject({ subject_id: "6.200", title: "Mid", prerequisites: "6.100" }),
  makeSubject({
    subject_id: "6.300",
    title: "Advanced",
    prerequisites: "6.200, 18.06",
  }),
  makeSubject({
    subject_id: "6.400",
    title: "Either-or",
    prerequisites: "6.100/(6.200, 18.06)",
  }),
  makeSubject({ subject_id: "18.06", title: "Linear Algebra" }),
  makeSubject({
    subject_id: "9.500",
    title: "By permission",
    prerequisites: "''permission of instructor''",
  }),
  makeSubject({
    subject_id: "9.600",
    title: "Subject or permission",
    prerequisites: "6.100/''permission of instructor''",
  }),
  makeSubject({
    subject_id: "9.700",
    title: "Subject and permission",
    prerequisites: "6.100, ''permission of instructor''",
  }),
  makeSubject({
    subject_id: "5.100",
    title: "Renumbered prereq",
    prerequisites: "5.OLD",
  }),
  makeSubject({ subject_id: "5.111", title: "Chem", old_id: "5.OLD" }),
]);

function subj(id: string): Subject {
  return getSubject(catalog, id) as Subject;
}

function roadWith(...entries: [string, number][]): SelectedSubject[][] {
  const buckets = emptyBuckets();
  for (const [id, semester] of entries) {
    buckets[semester].push(placed(id, semester));
  }
  return buckets;
}

function evaluate(
  id: string,
  buckets: SelectedSubject[][],
  currentSemester = 3,
  cat: CatalogView = catalog,
) {
  return createReadinessEvaluator(
    cat,
    buckets,
    currentSemester,
  )(getSubject(cat, id) as Subject);
}

describe("createReadinessEvaluator", () => {
  it("treats a subject with no prerequisites as ready", () => {
    expect(evaluate("6.100", emptyBuckets())).toEqual({ kind: "ready" });
  });

  it("is ready when the prereq was taken before the current term", () => {
    expect(evaluate("6.200", roadWith(["6.100", 1]), 3)).toEqual({
      kind: "ready",
    });
  });

  it("is ready-after with the earliest placeable bucket for planned prereqs", () => {
    // 6.100 planned in bucket 5 (the future) → 6.200 placeable from bucket 6
    expect(evaluate("6.200", roadWith(["6.100", 5]), 3)).toEqual({
      kind: "ready-after",
      term: 6,
    });
  });

  it("finds the exact earliest bucket across staggered prereqs", () => {
    const buckets = roadWith(["6.200", 4], ["18.06", 7]);
    const result = evaluate("6.300", buckets, 3);
    expect(result).toEqual({ kind: "ready-after", term: 8 });
  });

  it("reports the missing prereq subjects when the plan never satisfies them", () => {
    expect(evaluate("6.300", roadWith(["6.200", 1]), 3)).toEqual({
      kind: "missing",
      missing: ["18.06"],
      approximate: false,
    });
  });

  it("picks the cheapest any-branch for the missing set", () => {
    // 6.400 = 6.100 OR (6.200 AND 18.06); nothing taken → one subject beats two
    expect(evaluate("6.400", emptyBuckets(), 3)).toEqual({
      kind: "missing",
      missing: ["6.100"],
      approximate: false,
    });
  });

  it("prefers the any-branch the student already has progress in", () => {
    // 18.06 taken → the (6.200, 18.06) branch is one subject away, same cost
    // as the 6.100 branch, but it carries fulfilled progress → wins the tie
    expect(evaluate("6.400", roadWith(["18.06", 1]), 3)).toEqual({
      kind: "missing",
      missing: ["6.200"],
      approximate: false,
    });
  });

  it("returns unknown when only non-subject requirements are unmet", () => {
    expect(evaluate("9.500", emptyBuckets(), 3)).toEqual({ kind: "unknown" });
  });

  it("a permission alternative never masks a real missing subject", () => {
    expect(evaluate("9.600", emptyBuckets(), 3)).toEqual({
      kind: "missing",
      missing: ["6.100"],
      approximate: false,
    });
  });

  it("flags approximate when a non-subject term is unmet alongside subjects", () => {
    expect(evaluate("9.700", emptyBuckets(), 3)).toEqual({
      kind: "missing",
      missing: ["6.100"],
      approximate: true,
    });
  });

  it("resolves renumbered prereqs via old_id in the missing set", () => {
    expect(evaluate("5.100", emptyBuckets(), 3)).toEqual({
      kind: "missing",
      missing: ["5.111"],
      approximate: false,
    });
  });

  it("memoizes per subject and stays pure across evaluations", () => {
    const evaluator = createReadinessEvaluator(
      catalog,
      roadWith(["6.100", 1]),
      3,
    );
    const first = evaluator(subj("6.200"));
    expect(evaluator(subj("6.200"))).toBe(first);
    expect(evaluator(subj("6.300")).kind).toBe("missing");
  });
});
