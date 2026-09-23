/**
 * The student's notes on subjects ("check prereqs with prof"), keyed by
 * subject id: one note per subject, whichever road or term it sits in.
 *
 * Logged in, FireRoad holds them (/prefs/notes/, /prefs/set_notes/), so
 * they follow the student across devices and FireRoad's other clients.
 * Logged out, they live in this browser, under the storage consent like
 * logged-out roads, and are merged into FireRoad on the next login.
 *
 * /prefs/set_notes/ replaces the whole map, so every cloud save sends it
 * all; saves are debounced so a burst of edits is one request.
 */

import { defineStore } from "pinia";
import { toast } from "../design/toast";
import {
  STORAGE_KEYS,
  readValue,
  removeValue,
  writeValue,
} from "../lib/appStorage";
import type { SubjectNotes } from "../lib/fireroad";
import { useCourseDataStore } from "./courseData";
import { fireroad } from "./fireroadClient";
import { history } from "./history";

/** Longest note kept; the editor stops typing there too. */
export const NOTE_MAX_LENGTH = 280;

const CLOUD_SAVE_DELAY_MS = 600;

function readLocalNotes(): SubjectNotes {
  const stored = readValue<SubjectNotes>(STORAGE_KEYS.notes);
  return stored !== undefined && typeof stored === "object" ? stored : {};
}

let cloudTimer: ReturnType<typeof setTimeout> | undefined;
let cloudLoad: Promise<void> | undefined;

export const useNotesStore = defineStore("notes", {
  state: () => ({
    notes: readLocalNotes() as SubjectNotes,
    /**
     * Logged in: whether the cloud copy has arrived. Edits made before it
     * does are remembered here and win over the cloud copy on arrival.
     */
    cloudLoaded: false,
    editsBeforeLoad: {} as Record<string, string | null>,
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
      const courseData = useCourseDataStore();
      if (!courseData.loggedIn) {
        if (courseData.cookiesAllowed) {
          writeValue(STORAGE_KEYS.notes, { ...this.notes });
        }
        return;
      }
      if (!this.cloudLoaded) {
        // Never save before the cloud copy is in: set_notes replaces the
        // whole map, so a save now would wipe notes from other devices.
        // The load folds this edit in and saves it.
        this.editsBeforeLoad[subjectId] = text ?? null;
        void this.loadFromCloud();
        return;
      }
      this.scheduleCloudSave();
    },

    scheduleCloudSave() {
      clearTimeout(cloudTimer);
      cloudTimer = setTimeout(() => {
        cloudTimer = undefined;
        void this.saveToCloud();
      }, CLOUD_SAVE_DELAY_MS);
    },

    async saveToCloud(): Promise<boolean> {
      try {
        const response = await fireroad.setNotes({ ...this.notes });
        if (!response.data.success) {
          throw new Error(response.data.error ?? "set_notes failed");
        }
        return true;
      } catch (error) {
        console.warn("Couldn't save notes to FireRoad:", error);
        toast.warn(
          "Couldn't save your note",
          "It's kept in this tab and will be saved with your next change.",
        );
        return false;
      }
    },

    /**
     * After login: fetch the cloud notes and fold in anything written
     * logged out, or edited while the fetch was in flight. On a subject
     * with both, the cloud copy wins over the logged-out one, and an edit
     * made this session wins over both.
     */
    loadFromCloud(): Promise<void> {
      cloudLoad ??= this.fetchAndMerge().finally(() => {
        cloudLoad = undefined;
      });
      return cloudLoad;
    },

    async fetchAndMerge() {
      const local = readLocalNotes();
      let cloud: SubjectNotes;
      try {
        const response = await fireroad.getNotes();
        if (!response.data.success) {
          throw new Error(response.data.error ?? "notes failed");
        }
        cloud = response.data.notes ?? {};
      } catch (error) {
        // Keep what this tab has; the next edit retries the load.
        console.warn("Couldn't load notes from FireRoad:", error);
        return;
      }
      const merged: SubjectNotes = { ...local, ...cloud };
      for (const [subjectId, text] of Object.entries(this.editsBeforeLoad)) {
        if (text === null) {
          delete merged[subjectId];
        } else {
          merged[subjectId] = text;
        }
      }
      const changedByUs =
        Object.keys(this.editsBeforeLoad).length > 0 ||
        Object.keys(local).some((id) => !(id in cloud));
      this.notes = merged;
      this.cloudLoaded = true;
      this.editsBeforeLoad = {};
      // The browser copy goes once the cloud has everything in it.
      if (!changedByUs || (await this.saveToCloud())) {
        removeValue(STORAGE_KEYS.notes);
      }
    },
  },
});
