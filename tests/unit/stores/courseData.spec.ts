import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useCourseDataStore } from "../../../src/stores/courseData";
import { history } from "../../../src/stores/history";
import { newRoad } from "../../../src/lib/roads";
import { placed } from "../lib/fixtures";

/**
 * Store-level tests for the undo/redo contract and the crash guards. These
 * exercise the seam that unit-level lib tests can't reach: mutation actions,
 * their recorded inverses, and the temp→server id rename (resetID).
 */
describe("courseData store: undo/redo + guards", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    history.clear();
  });

  const DEFAULT = "$defaultroad$";
  const contentsOf = (id: string) => useCourseDataStore().roads[id].contents;

  it("a mixed mutation sequence round-trips through undo-all / redo-all", () => {
    const store = useCourseDataStore();
    const before = JSON.stringify(contentsOf(DEFAULT));

    store.addClass(placed("6.006", 1));
    store.addClass(placed("8.01", 2));
    store.moveClass({
      currentClass: contentsOf(DEFAULT).selectedSubjects[1][0],
      classIndex: 0,
      semester: 3,
    });
    store.addReq("major6-3");
    store.removeClass({
      classInfo: contentsOf(DEFAULT).selectedSubjects[2][0],
      classIndex: 0,
    });
    const after = JSON.stringify(contentsOf(DEFAULT));
    expect(after).not.toBe(before);

    while (history.canUndo) history.undo();
    expect(JSON.stringify(contentsOf(DEFAULT))).toBe(before);

    while (history.canRedo) history.redo();
    expect(JSON.stringify(contentsOf(DEFAULT))).toBe(after);
  });

  it("undo still reverts an edit made before a temp→server id reset (C1)", () => {
    const store = useCourseDataStore();
    expect(store.activeRoad).toBe(DEFAULT);
    store.addClass(placed("6.006", 1));
    expect(contentsOf(DEFAULT).selectedSubjects[1]).toHaveLength(1);

    // First autosave assigns the real server id; the road key changes.
    store.resetID({ oldid: DEFAULT, newid: "4321" });
    expect(store.activeRoad).toBe("4321");
    expect(DEFAULT in store.roads).toBe(false);

    // The undo closure captured the OLD key; it must still land on the road.
    history.undo();
    expect(contentsOf("4321").selectedSubjects[1]).toHaveLength(0);

    history.redo();
    expect(contentsOf("4321").selectedSubjects[1]).toHaveLength(1);
    expect(contentsOf("4321").selectedSubjects[1][0].subject_id).toBe("6.006");
  });

  it("manual progress records its own undo pair, not the previous action (C5)", () => {
    const store = useCourseDataStore();
    store.addClass(placed("6.006", 1)); // unrelated earlier action
    store.updateProgress({ listID: "req-x", progress: 50 });
    expect(contentsOf(DEFAULT).progressOverrides["req-x"]).toBe(50);

    // ⌘Z must undo the progress edit and leave the class in place.
    history.undo();
    expect(contentsOf(DEFAULT).progressOverrides["req-x"]).toBeUndefined();
    expect(contentsOf(DEFAULT).selectedSubjects[1]).toHaveLength(1);
  });

  it("substitution + ignore round-trip through undo (C5)", () => {
    const store = useCourseDataStore();
    const pa = () => contentsOf(DEFAULT).progressAssertions;

    store.setPASubstitutions({ uniqueKey: "k", newReqs: ["6.001"] });
    expect(pa()["k"]).toEqual({ substitutions: ["6.001"] });

    store.setPAIgnore({ uniqueKey: "k", isIgnored: true });
    expect(pa()["k"]).toEqual({ substitutions: ["6.001"], ignore: true });

    history.undo(); // undo the ignore
    expect(pa()["k"]).toEqual({ substitutions: ["6.001"] });

    history.undo(); // undo the substitution
    expect(pa()["k"]).toBeUndefined();
  });

  it("overrideWarnings round-trips and only records real changes (C5)", () => {
    const store = useCourseDataStore();
    store.addClass(placed("6.006", 1, { overrideWarnings: false }));
    const cls = contentsOf(DEFAULT).selectedSubjects[1][0];

    store.overrideWarnings({ classInfo: cls, override: true });
    expect(cls.overrideWarnings).toBe(true);
    history.undo();
    expect(cls.overrideWarnings).toBe(false);

    // A no-op toggle must not push a misleading entry onto the stack.
    const depth = history.state.undoStack.length;
    store.overrideWarnings({ classInfo: cls, override: false });
    expect(history.state.undoStack.length).toBe(depth);
  });

  it("unignoring a nonexistent assertion does not throw (B4)", () => {
    const store = useCourseDataStore();
    expect(() =>
      store.setPAIgnore({ uniqueKey: "nope", isIgnored: false }),
    ).not.toThrow();
    expect(contentsOf(DEFAULT).progressAssertions["nope"]).toBeUndefined();
  });

  it("addClass with no active road is a no-op, not a crash (B5)", () => {
    const store = useCourseDataStore();
    store.setActiveRoad("");
    expect(() => store.addClass(placed("6.006", 1))).not.toThrow();
    expect(history.canUndo).toBe(false);
  });

  it("edits + undo land on a REUSED temp key's new road, not the aliased one (R2)", () => {
    const store = useCourseDataStore();
    // Road #1 lives under the default key, gets work, then a server id.
    store.addClass(placed("18.01", 1));
    store.resetID({ oldid: DEFAULT, newid: "55" });
    history.clear();
    // Road #2 REUSES the same temp key (newRoads.length collapses to 0).
    store.setRoad({ id: DEFAULT, road: newRoad("Second"), ignoreSet: false });
    store.setActiveRoad(DEFAULT);

    // A plain edit on #2 must not leak into #55 via a stale alias (probe 1).
    store.updateProgress({ listID: "req-x", progress: 42 });
    expect(contentsOf(DEFAULT).progressOverrides["req-x"]).toBe(42);
    expect(contentsOf("55").progressOverrides["req-x"]).toBeUndefined();

    // Adding to #2 and undoing must affect #2, never #55 (probe 2).
    store.addClass(placed("6.006", 2));
    expect(contentsOf(DEFAULT).selectedSubjects[2]).toHaveLength(1);
    history.undo();
    expect(contentsOf(DEFAULT).selectedSubjects[2]).toHaveLength(0);
    expect(contentsOf("55").selectedSubjects[1]).toHaveLength(1); // #1 untouched
  });

  it("overrideWarnings undo reverts even after an intervening remove+undo (R5)", () => {
    const store = useCourseDataStore();
    store.addClass(placed("6.006", 1, { overrideWarnings: false }));
    const cls0 = contentsOf(DEFAULT).selectedSubjects[1][0];
    store.overrideWarnings({ classInfo: cls0, override: true });
    expect(contentsOf(DEFAULT).selectedSubjects[1][0].overrideWarnings).toBe(
      true,
    );

    // remove + undo(remove) reinserts a CLONE; different object identity.
    store.removeClass({
      classInfo: contentsOf(DEFAULT).selectedSubjects[1][0],
      classIndex: 0,
    });
    history.undo();
    const reinserted = contentsOf(DEFAULT).selectedSubjects[1][0];
    expect(reinserted).not.toBe(cls0);
    expect(reinserted.overrideWarnings).toBe(true);

    // Undo the override: a positional locator finds the clone; identity wouldn't.
    history.undo();
    expect(contentsOf(DEFAULT).selectedSubjects[1][0].overrideWarnings).toBe(
      false,
    );
  });

  it("custom-class edit undo reverts even after an intervening remove+undo (R5)", () => {
    const store = useCourseDataStore();
    store.addClass(placed("MyClass", 1, { public: false, title: "Original" }));
    const cls0 = contentsOf(DEFAULT).selectedSubjects[1][0];
    store.editCustomClass(cls0);
    store.finishEditCustomClass({
      subject_id: "MyClass",
      title: "Edited",
      total_units: 9,
      public: false,
    } as never);
    expect(contentsOf(DEFAULT).selectedSubjects[1][0].title).toBe("Edited");

    store.removeClass({
      classInfo: contentsOf(DEFAULT).selectedSubjects[1][0],
      classIndex: 0,
    });
    history.undo(); // undo remove -> reinserts a clone
    history.undo(); // undo edit -> positional revert
    expect(contentsOf(DEFAULT).selectedSubjects[1][0].title).toBe("Original");
  });

  it("setRoadProp on a since-deleted road is a no-op, not a crash (R3b)", () => {
    const store = useCourseDataStore();
    expect(() =>
      store.setRoadProp({
        id: "gone",
        prop: "downloaded",
        value: "x" as never,
        ignoreSet: true,
      }),
    ).not.toThrow();
  });

  it("a new history entry is detectable by identity at the MAX_ENTRIES cap (R4)", () => {
    // confirmPlacement's capture must not rely on a length delta: at the cap,
    // record() pushes then shifts the bottom off, so length is unchanged.
    const noop = () => {};
    for (let i = 0; i < 100; i++) history.record("filler " + i, noop, noop);
    const stack = history.state.undoStack;
    const lenBefore = stack.length;
    const topBefore = stack[stack.length - 1];
    history.record("placement", noop, noop);
    const topAfter = stack[stack.length - 1];
    expect(stack.length).toBe(lenBefore); // length unchanged at the cap...
    expect(topAfter).not.toBe(topBefore); // ...but identity detects the new entry
    expect(topAfter.label).toBe("placement");
  });
});
