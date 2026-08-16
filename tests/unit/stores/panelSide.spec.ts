import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { STORAGE_KEYS, readValue } from "../../../src/lib/appStorage";
import { useCourseDataStore } from "../../../src/stores/courseData";

/**
 * Which edge the progress panel sits on is a stored preference, so it has
 * to survive a reload and has to tolerate whatever is already in storage.
 */
describe("progress panel side", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("starts on the right when nothing is stored", () => {
    expect(useCourseDataStore().panelSide).toBe("right");
  });

  it("writes the choice, and a fresh store reads it back", () => {
    useCourseDataStore().setPanelSide("left");
    expect(readValue<string>(STORAGE_KEYS.panelSide)).toBe("left");

    // A new Pinia is what a reload looks like: state comes from storage.
    setActivePinia(createPinia());
    expect(useCourseDataStore().panelSide).toBe("left");
  });

  it("moves back to the right and persists that too", () => {
    useCourseDataStore().setPanelSide("left");
    setActivePinia(createPinia());
    useCourseDataStore().setPanelSide("right");

    setActivePinia(createPinia());
    expect(useCourseDataStore().panelSide).toBe("right");
  });

  it("falls back to the right when the stored value is not a side", () => {
    // Hand-edited or written by an older build; the panel still has to land
    // somewhere rather than render unplaced.
    for (const junk of ["centre", "", "LEFT", 3, null]) {
      localStorage.setItem(
        STORAGE_KEYS.panelSide,
        JSON.stringify({ v: junk, e: 0 }),
      );
      setActivePinia(createPinia());
      expect(useCourseDataStore().panelSide).toBe("right");
    }
  });
});
