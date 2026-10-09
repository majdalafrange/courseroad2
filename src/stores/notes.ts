/**
 * The student's notes on subjects ("check prereqs with prof"), keyed by
 * subject id: one note per subject, whichever road or term it sits in.
 *
 * Logged in, FireRoad holds them (/prefs/notes/, /prefs/set_notes/), so
 * they follow the student across devices and FireRoad's other clients.
 * Logged out, they live in this browser, under the storage consent like
 * logged-out roads, and are merged into FireRoad on the next login.
 *
 * The sync itself is stores/cloudSync.ts, shared with favorites.
 */

import { defineStore } from "pinia";
import { STORAGE_KEYS, readValue } from "../lib/appStorage";
import type { SubjectNotes } from "../lib/fireroad";
import { createCloudSync, type SyncedState } from "./cloudSync";
import { useCourseDataStore } from "./courseData";
import { fireroad } from "./fireroadClient";
import { history } from "./history";

/** Longest note kept; the editor stops typing there too. */
export const NOTE_MAX_LENGTH = 280;

function readLocalNotes(): SubjectNotes {
  const stored = readValue<SubjectNotes>(STORAGE_KEYS.notes);
  return stored !== undefined && typeof stored === "object" ? stored : {};
}

/** A pre-load edit: the note's new text, or null for a removal. */
interface NotesState extends SyncedState<string | null> {
  notes: SubjectNotes;
}

const sync = createCloudSync<SubjectNotes, string | null, NotesState>({
  name: "notes",
  storageKey: STORAGE_KEYS.notes,
  readLocal: readLocalNotes,
  current: (store) => ({ ...store.notes }),
  replace: (store, notes) => {
    store.notes = notes;
  },
  async fetchCloud() {
    const response = await fireroad.getNotes();
    if (!response.data.success) {
      throw new Error(response.data.error ?? "notes failed");
    }
    return response.data.notes ?? {};
  },
  async saveCloud(notes) {
    const response = await fireroad.setNotes(notes);
    if (!response.data.success) {
      throw new Error(response.data.error ?? "set_notes failed");
    }
  },
  // On a subject with both, the cloud note wins over the logged-out one,
  // and an edit made this session wins over both.
  merge(cloud, local, edits) {
    const merged: SubjectNotes = { ...local, ...cloud };
    for (const [subjectId, text] of Object.entries(edits)) {
      if (text === null) {
        delete merged[subjectId];
      } else {
        merged[subjectId] = text;
      }
    }
    const changed =
      Object.keys(edits).length > 0 ||
      Object.keys(local).some((id) => !(id in cloud));
    return { value: merged, changed };
  },
  saveFailed: [
    "Couldn't save your note",
    "It's kept in this tab and will be saved with your next change.",
  ],
});

export const useNotesStore = defineStore("notes", {
  state: (): NotesState => ({
    notes: readLocalNotes(),
    cloudLoaded: false,
    editsBeforeLoad: {},
  }),

  actions: {
    noteFor(subjectId: string): string | undefined {
      return this.notes[subjectId];
    },

    /** Set, change, or (with blank text) remove a subject's note. Undoable. */
    setNote(subjectId: string, text: string) {
      const before = this.notes[subjectId];
      const trimmed = text.trim().slice(0, NOTE_MAX_LENGTH);
      const after = trimmed === "" ? undefined : trimmed;
      if (before === after) {
        return;
      }
      this.writeNote(subjectId, after);
      history.record(
        after === undefined
          ? `Removed the note on ${subjectId}`
          : before === undefined
            ? `Added a note to ${subjectId}`
            : `Edited the note on ${subjectId}`,
        () => this.writeNote(subjectId, before),
        () => this.writeNote(subjectId, after),
        useCourseDataStore().activeRoad,
      );
    },

    /** Low-level write, then persist; `undefined` removes. No history. */
    writeNote(subjectId: string, text: string | undefined) {
      if (text === undefined) {
        delete this.notes[subjectId];
      } else {
        this.notes[subjectId] = text;
      }
      sync.afterEdit(this, subjectId, text ?? null);
    },

    /** After login: fetch the cloud notes and fold in local changes. */
    loadFromCloud(): Promise<void> {
      return sync.load(this);
    },
  },
});
