// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useCourseDataStore } from "../../../src/stores/courseData";
import { history } from "../../../src/stores/history";
import { addRoad, duplicateRoad } from "../../../src/stores/roadOps";

describe("road copies keep requirement assertions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    history.clear();
  });

  it("an added road starts with the assertions it is given", () => {
    const id = addRoad(
      "Imported",
      ["girs"],
      undefined,
      {},
      {
        "girs.0": { ignore: true },
      },
    );
    expect(useCourseDataStore().roads[id].contents.progressAssertions).toEqual({
      "girs.0": { ignore: true },
    });
  });

  it("a duplicate copies them, and redo copies them again", () => {
    const store = useCourseDataStore();
    const source = addRoad(
      "Mine",
      ["girs"],
      undefined,
      {},
      {
        "major18gm.1.1": { override: 3 },
      },
    );
    const before = new Set(Object.keys(store.roads));
    duplicateRoad(source);
    const copy = Object.keys(store.roads).find((id) => !before.has(id))!;
    const assertions = () => store.roads[copy]?.contents.progressAssertions;
    expect(assertions()).toEqual({ "major18gm.1.1": { override: 3 } });
    // A copy, not the same object.
    expect(assertions()).not.toBe(
      store.roads[source].contents.progressAssertions,
    );

    history.undo();
    history.redo();
    expect(assertions()).toEqual({ "major18gm.1.1": { override: 3 } });
  });
});
