import { describe, expect, it } from "vitest";
import {
  classifyProgram,
  groupFits,
  rankFits,
  roadFingerprint,
  scannablePrograms,
  toFit,
  type ProgramFit,
} from "../../../src/lib/degreeFit";
import type { ReqListEntry, RequirementNode } from "../../../src/lib/types";

function entry(key: string, mediumTitle = key): ReqListEntry {
  return {
    key,
    "list-id": `${key}.reql`,
    "short-title": key,
    "medium-title": mediumTitle,
  };
}

/** A FireRoad progress tree with only the top-level fields the scan reads. */
function tree(node: Partial<RequirementNode>): RequirementNode {
  return node as RequirementNode;
}

function ok(node: Partial<RequirementNode>) {
  return { ok: true as const, tree: tree(node) };
}

describe("classifyProgram", () => {
  it("reads the category off the key, not the display title", () => {
    expect(classifyProgram("major6-3")).toBe("major");
    expect(classifyProgram("minorWGS")).toBe("minor");
  });

  it("excludes the non-degree lists FireRoad ships alongside", () => {
    for (const key of [
      "girs",
      "masterBAn",
      "mfin",
      "master6-P",
      "neetAM",
      "neetLM-CB",
      "prehealth",
    ]) {
      expect(classifyProgram(key)).toBeUndefined();
    }
  });

  it("does not mistake 'master' for 'major'", () => {
    expect(classifyProgram("master6-9P")).toBeUndefined();
  });
});

describe("scannablePrograms", () => {
  it("keeps majors and minors and drops everything else", () => {
    const list = [
      entry("girs"),
      entry("major6-3"),
      entry("masterBAn"),
      entry("minor18"),
      entry("neetAM"),
    ];
    expect(scannablePrograms(list).map((e) => e.key)).toEqual([
      "major6-3",
      "minor18",
    ]);
  });

  it("orders by key so two scans queue the same way", () => {
    const list = [entry("minor6"), entry("major18pm"), entry("major2a")];
    expect(scannablePrograms(list).map((e) => e.key)).toEqual([
      "major18pm",
      "major2a",
      "minor6",
    ]);
  });

  it("does not mutate the list it is given", () => {
    const list = [entry("minor6"), entry("major2a")];
    scannablePrograms(list);
    expect(list.map((e) => e.key)).toEqual(["minor6", "major2a"]);
  });
});

describe("toFit", () => {
  it("carries FireRoad's own percent and counters through", () => {
    const fit = toFit(
      entry("major6-3", "6-3 Major"),
      ok({ percent_fulfilled: 19, progress: 3, max: 16, fulfilled: false }),
      false,
    );
    expect(fit).toMatchObject({
      key: "major6-3",
      title: "6-3 Major",
      category: "major",
      percent: 19,
      progress: 3,
      max: 16,
      remaining: 13,
      complete: false,
      onRoad: false,
    });
    expect(fit.unranked).toBeUndefined();
  });

  it("marks a finished program complete", () => {
    const fit = toFit(
      entry("minor6"),
      ok({ percent_fulfilled: 100, progress: 6, max: 6, fulfilled: true }),
      true,
    );
    expect(fit.complete).toBe(true);
    expect(fit.remaining).toBe(0);
    expect(fit.onRoad).toBe(true);
  });

  it("reports 'N/A' as unranked rather than as zero percent", () => {
    const fit = toFit(
      entry("major18pm"),
      ok({ percent_fulfilled: "N/A", progress: 0, max: 11 }),
      false,
    );
    expect(fit.unranked).toBe("no-percent");
    expect(fit.percent).toBeUndefined();
  });

  it("still ranks a complete program that reports no percentage", () => {
    const fit = toFit(entry("minor6"), ok({ fulfilled: true }), false);
    expect(fit.unranked).toBeUndefined();
    expect(fit.complete).toBe(true);
    expect(fit.percent).toBe(100);
  });

  it("treats a failed request as unknown, never as zero percent", () => {
    const fit = toFit(
      entry("major18"),
      { ok: false, error: "400: the requirements list major18 does not exist" },
      false,
    );
    expect(fit.unranked).toBe("fetch-failed");
    expect(fit.percent).toBeUndefined();
    expect(fit.error).toContain("does not exist");
  });

  it("survives a 200 that is not a requirement tree", () => {
    const fit = toFit(
      entry("major6-3"),
      { ok: true, tree: null as unknown as RequirementNode },
      false,
    );
    expect(fit.unranked).toBe("fetch-failed");
  });

  it("guards a missing or zero max instead of dividing by it", () => {
    const noMax = toFit(
      entry("major6-3"),
      ok({ percent_fulfilled: 0, progress: 0 }),
      false,
    );
    expect(noMax.percent).toBe(0);
    expect(noMax.remaining).toBeUndefined();

    const zeroMax = toFit(
      entry("major2a"),
      ok({ percent_fulfilled: 0, progress: 0, max: 0 }),
      false,
    );
    expect(zeroMax.remaining).toBe(0);
  });

  it("clamps a percentage outside 0 to 100 and rounds it", () => {
    expect(
      toFit(entry("major6-3"), ok({ percent_fulfilled: 118.4 }), false).percent,
    ).toBe(100);
    expect(
      toFit(entry("major6-3"), ok({ percent_fulfilled: -5 }), false).percent,
    ).toBe(0);
    expect(
      toFit(entry("major6-3"), ok({ percent_fulfilled: 18.6 }), false).percent,
    ).toBe(19);
  });

  it("never reports negative remaining work", () => {
    const fit = toFit(
      entry("minor6"),
      ok({ percent_fulfilled: 100, progress: 8, max: 6 }),
      false,
    );
    expect(fit.remaining).toBe(0);
  });

  it("falls back to the key when a title is missing", () => {
    const bare = { ...entry("major6-3"), "medium-title": "" };
    expect(toFit(bare, ok({ percent_fulfilled: 0 }), false).title).toBe(
      "major6-3",
    );
  });
});

describe("rankFits", () => {
  const fit = (over: Partial<ProgramFit>): ProgramFit => ({
    key: "k",
    title: "t",
    category: "major",
    complete: false,
    onRoad: false,
    ...over,
  });

  it("puts the nearest-finished program first", () => {
    const ranked = rankFits([
      fit({ key: "a", percent: 10, remaining: 14 }),
      fit({ key: "b", percent: 62, remaining: 6 }),
      fit({ key: "c", percent: 31, remaining: 11 }),
    ]);
    expect(ranked.map((f) => f.key)).toEqual(["b", "c", "a"]);
  });

  it("floats completed programs above every partial one", () => {
    const ranked = rankFits([
      fit({ key: "partial", percent: 99, remaining: 1 }),
      fit({ key: "done", percent: 100, remaining: 0, complete: true }),
    ]);
    expect(ranked[0].key).toBe("done");
  });

  it("breaks a percent tie on the work left", () => {
    const ranked = rankFits([
      fit({ key: "big", percent: 50, remaining: 8 }),
      fit({ key: "small", percent: 50, remaining: 3 }),
    ]);
    expect(ranked.map((f) => f.key)).toEqual(["small", "big"]);
  });

  it("orders an empty road deterministically instead of reshuffling", () => {
    const tied = [
      fit({ key: "minor6", percent: 0, remaining: 6 }),
      fit({ key: "major2a", percent: 0, remaining: 6 }),
      fit({ key: "major18pm", percent: 0, remaining: 6 }),
    ];
    const once = rankFits(tied).map((f) => f.key);
    const twice = rankFits(tied.slice().reverse()).map((f) => f.key);
    expect(once).toEqual(["major18pm", "major2a", "minor6"]);
    expect(once).toEqual(twice);
  });

  it("does not mutate its input", () => {
    const input = [
      fit({ key: "a", percent: 10 }),
      fit({ key: "b", percent: 90 }),
    ];
    rankFits(input);
    expect(input.map((f) => f.key)).toEqual(["a", "b"]);
  });
});

describe("groupFits", () => {
  it("ranks majors and minors apart, since their scales differ", () => {
    const groups = groupFits([
      toFit(entry("major6-3"), ok({ percent_fulfilled: 19, max: 16 }), false),
      toFit(entry("minor6"), ok({ percent_fulfilled: 50, max: 6 }), false),
      toFit(entry("major6-14"), ok({ percent_fulfilled: 21, max: 19 }), false),
    ]);
    expect(groups.majors.map((f) => f.key)).toEqual(["major6-14", "major6-3"]);
    expect(groups.minors.map((f) => f.key)).toEqual(["minor6"]);
  });

  it("surfaces unreachable programs instead of dropping them", () => {
    const groups = groupFits([
      toFit(entry("major6-3"), ok({ percent_fulfilled: 19 }), false),
      toFit(
        entry("major22"),
        { ok: false, error: "FireRoad responded 500" },
        false,
      ),
      toFit(entry("minor21H"), ok({ percent_fulfilled: "N/A" }), false),
    ]);
    expect(groups.majors.map((f) => f.key)).toEqual(["major6-3"]);
    expect(groups.failed.map((f) => f.key)).toEqual(["major22"]);
    expect(groups.unranked.map((f) => f.key)).toEqual(["minor21H"]);
  });

  it("accounts for every program it is given", () => {
    const keys = ["major6-3", "major22", "minor6", "minor21H", "major2a"];
    const groups = groupFits(
      keys.map((k, i) =>
        toFit(
          entry(k),
          i === 1
            ? { ok: false, error: "boom" }
            : ok({ percent_fulfilled: i === 3 ? "N/A" : i * 10 }),
          false,
        ),
      ),
    );
    const seen = [
      ...groups.majors,
      ...groups.minors,
      ...groups.unranked,
      ...groups.failed,
    ].map((f) => f.key);
    expect(seen.slice().sort()).toEqual(keys.slice().sort());
  });

  it("handles an empty scan", () => {
    const groups = groupFits([]);
    expect(groups).toEqual({
      majors: [],
      minors: [],
      unranked: [],
      failed: [],
    });
  });
});

describe("roadFingerprint", () => {
  const base = {
    selectedSubjects: [
      { subject_id: "18.01", semester: 1 },
      { subject_id: "8.01", semester: 1 },
    ],
    progressOverrides: [] as never[],
    progressAssertions: {},
  };

  it("ignores the order subjects happen to be listed in", () => {
    expect(roadFingerprint(base)).toBe(
      roadFingerprint({
        ...base,
        selectedSubjects: base.selectedSubjects.slice().reverse(),
      }),
    );
  });

  it("changes when a subject moves to another term", () => {
    expect(roadFingerprint(base)).not.toBe(
      roadFingerprint({
        ...base,
        selectedSubjects: [
          { subject_id: "18.01", semester: 4 },
          { subject_id: "8.01", semester: 1 },
        ],
      }),
    );
  });

  it("changes when a class is added or removed", () => {
    expect(roadFingerprint(base)).not.toBe(
      roadFingerprint({
        ...base,
        selectedSubjects: [
          ...base.selectedSubjects,
          { subject_id: "6.100A", semester: 1 },
        ],
      }),
    );
  });

  it("changes when a requirement is petitioned or ignored", () => {
    expect(roadFingerprint(base)).not.toBe(
      roadFingerprint({
        ...base,
        progressAssertions: { "major6-3.0.1": { ignore: true } },
      }),
    );
  });

  it("changes when a manual progress override is set", () => {
    expect(roadFingerprint(base)).not.toBe(
      roadFingerprint({ ...base, progressOverrides: { "major6-3.0.1": 2 } }),
    );
  });

  it("is stable for an untouched road", () => {
    expect(roadFingerprint(base)).toBe(roadFingerprint({ ...base }));
  });
});
