import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// Mock the FireRoad client singleton before the notes store imports it.
const mocks = vi.hoisted(() => ({
  getNotes: vi.fn(),
  setNotes: vi.fn(),
}));

vi.mock("../../../src/stores/fireroadClient", () => ({
  setFireroadToken: vi.fn(),
  fireroad: { getNotes: mocks.getNotes, setNotes: mocks.setNotes },
}));

import {
  STORAGE_KEYS,
  readValue,
  writeValue,
} from "../../../src/lib/appStorage";
import { useCourseDataStore } from "../../../src/stores/courseData";
import { history } from "../../../src/stores/history";
import { NOTE_MAX_LENGTH, useNotesStore } from "../../../src/stores/notes";

/**
 * Subject notes: FireRoad's /prefs/notes/ when logged in (set_notes
 * replaces the whole map), this browser when logged out, merged on login.
 */

function cloudReturns(notes: Record<string, string>) {
  mocks.getNotes.mockResolvedValue({
    status: 200,
    data: { success: true, notes },
  });
}

function lastSavedMap(): Record<string, string> {
  const calls = mocks.setNotes.mock.calls;
  return calls[calls.length - 1][0] as Record<string, string>;
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  mocks.getNotes.mockReset();
  mocks.setNotes.mockReset();
  mocks.setNotes.mockResolvedValue({ status: 200, data: { success: true } });
  history.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("logged out", () => {
  it("keeps notes in this browser, with consent", () => {
    useCourseDataStore().allowCookies();
    const notes = useNotesStore();

    notes.setNote("6.006", "  check prereqs with prof  ");

    expect(notes.noteFor("6.006")).toBe("check prereqs with prof");
    expect(readValue(STORAGE_KEYS.notes)).toEqual({
      "6.006": "check prereqs with prof",
    });
    expect(mocks.setNotes).not.toHaveBeenCalled();
  });

  it("writes nothing to storage without consent", () => {
    useCourseDataStore().disallowCookies();
    useNotesStore().setNote("6.006", "tab only");

    expect(readValue(STORAGE_KEYS.notes)).toBeUndefined();
  });

  it("removes a note on blank text, caps length, and undoes", () => {
    useCourseDataStore().allowCookies();
    const notes = useNotesStore();

    notes.setNote("8.01", "x".repeat(NOTE_MAX_LENGTH + 50));
    expect(notes.noteFor("8.01")).toHaveLength(NOTE_MAX_LENGTH);

    notes.setNote("8.01", "   ");
    expect(notes.noteFor("8.01")).toBeUndefined();

    history.undo();
    expect(notes.noteFor("8.01")).toHaveLength(NOTE_MAX_LENGTH);
  });
});

describe("logged in", () => {
  beforeEach(() => {
    const store = useCourseDataStore();
    store.allowCookies();
    store.setLoggedIn(true);
  });

  it("loads the cloud notes and saves the whole map, debounced", async () => {
    cloudReturns({ "18.01": "cloud note" });
    const notes = useNotesStore();
    await notes.loadFromCloud();
    expect(notes.noteFor("18.01")).toBe("cloud note");
    // Nothing of ours to add: no save on load.
    expect(mocks.setNotes).not.toHaveBeenCalled();

    notes.setNote("6.006", "first");
    notes.setNote("6.006", "second");
    expect(mocks.setNotes).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();

    expect(mocks.setNotes).toHaveBeenCalledTimes(1);
    expect(lastSavedMap()).toEqual({
      "18.01": "cloud note",
      "6.006": "second",
    });
  });

  it("merges logged-out notes into the cloud on login, cloud first", async () => {
    writeValue(STORAGE_KEYS.notes, {
      "6.006": "from this browser",
      "18.01": "older local copy",
    });
    cloudReturns({ "18.01": "cloud copy" });
    const notes = useNotesStore();

    await notes.loadFromCloud();

    expect(notes.notes).toEqual({
      "6.006": "from this browser",
      "18.01": "cloud copy",
    });
    expect(lastSavedMap()).toEqual(notes.notes);
    // Handed over: the browser copy is gone.
    expect(readValue(STORAGE_KEYS.notes)).toBeUndefined();
  });

  it("never saves before the cloud copy is in; an early edit wins", async () => {
    let resolve!: (value: unknown) => void;
    mocks.getNotes.mockReturnValue(new Promise((r) => (resolve = r)));
    const notes = useNotesStore();
    const load = notes.loadFromCloud();

    notes.setNote("6.006", "typed while loading");
    // A save now would replace the cloud map with this one note.
    await vi.runAllTimersAsync();
    expect(mocks.setNotes).not.toHaveBeenCalled();

    resolve({
      status: 200,
      data: { success: true, notes: { "6.006": "stale", "8.01": "kept" } },
    });
    await load;

    expect(notes.notes).toEqual({
      "6.006": "typed while loading",
      "8.01": "kept",
    });
    expect(lastSavedMap()).toEqual(notes.notes);
  });

  it("after a failed load, holds edits and retries the load, not a save", async () => {
    mocks.getNotes.mockRejectedValueOnce(new Error("offline"));
    const notes = useNotesStore();
    await notes.loadFromCloud();
    expect(notes.cloudLoaded).toBe(false);

    cloudReturns({ "8.01": "cloud" });
    notes.setNote("6.006", "after the outage");
    await vi.runAllTimersAsync();

    expect(mocks.getNotes).toHaveBeenCalledTimes(2);
    expect(lastSavedMap()).toEqual({
      "8.01": "cloud",
      "6.006": "after the outage",
    });
  });
});
