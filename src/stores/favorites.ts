/**
 * The student's favorite subjects: an ordered list of subject ids, shown
 * at the top of the command palette before any search.
 *
 * Logged in, FireRoad holds the list (/prefs/favorites/,
 * /prefs/set_favorites/), shared with FireRoad's other clients. Logged
 * out, it lives in this browser, under the storage consent like
 * logged-out roads, and is merged into FireRoad on the next login.
 *
 * /prefs/set_favorites/ replaces the whole list, so every cloud save
 * sends all of it, and nothing is saved before the cloud copy has loaded
 * (a save then would wipe favorites made on other devices). Same shape as
 * stores/notes.ts.
 */

import { defineStore } from "pinia";
import { toast } from "../design/toast";
import {
  STORAGE_KEYS,
  readValue,
  removeValue,
  writeValue,
} from "../lib/appStorage";
import { useCourseDataStore } from "./courseData";
import { fireroad } from "./fireroadClient";

const CLOUD_SAVE_DELAY_MS = 600;

function readLocalFavorites(): string[] {
  const stored = readValue<string[]>(STORAGE_KEYS.favorites);
  return Array.isArray(stored)
    ? stored.filter((id): id is string => typeof id === "string")
    : [];
}

let cloudTimer: ReturnType<typeof setTimeout> | undefined;
let cloudLoad: Promise<void> | undefined;

export const useFavoritesStore = defineStore("favorites", {
  state: () => ({
    /** Subject ids, oldest favorite first. */
    ids: readLocalFavorites(),
    /** Logged in: whether the cloud copy has arrived. */
    cloudLoaded: false,
    /** Toggles made before the cloud copy arrived: id -> now a favorite. */
    editsBeforeLoad: {} as Record<string, boolean>,
  }),

  actions: {
    isFavorite(subjectId: string): boolean {
      return this.ids.includes(subjectId);
    },

    /** Add or remove one subject. A new favorite goes to the end. */
    setFavorite(subjectId: string, favorite: boolean) {
      if (this.isFavorite(subjectId) === favorite) {
        return;
      }
      this.ids = favorite
        ? [...this.ids, subjectId]
        : this.ids.filter((id) => id !== subjectId);
      const courseData = useCourseDataStore();
      if (!courseData.loggedIn) {
        if (courseData.cookiesAllowed) {
          writeValue(STORAGE_KEYS.favorites, [...this.ids]);
        }
        return;
      }
      if (!this.cloudLoaded) {
        // The load folds this in and saves it; a save now would replace
        // the cloud list with this tab's partial one.
        this.editsBeforeLoad[subjectId] = favorite;
        void this.loadFromCloud();
        return;
      }
      this.scheduleCloudSave();
    },

    toggleFavorite(subjectId: string) {
      this.setFavorite(subjectId, !this.isFavorite(subjectId));
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
        const response = await fireroad.setFavorites([...this.ids]);
        if (!response.data.success) {
          throw new Error(response.data.error ?? "set_favorites failed");
        }
        return true;
      } catch (error) {
        console.warn("Couldn't save favorites to FireRoad:", error);
        toast.warn(
          "Couldn't save your favorites",
          "They're kept in this tab and will be saved with your next change.",
        );
        return false;
      }
    },

    /**
     * After login: fetch the cloud list and fold in favorites made while
     * logged out (appended, in their order) and toggles made while the
     * fetch was in flight (which win).
     */
    loadFromCloud(): Promise<void> {
      cloudLoad ??= this.fetchAndMerge().finally(() => {
        cloudLoad = undefined;
      });
      return cloudLoad;
    },

    async fetchAndMerge() {
      const local = readLocalFavorites();
      let cloud: string[];
      try {
        const response = await fireroad.getFavorites();
        if (!response.data.success) {
          throw new Error(response.data.error ?? "favorites failed");
        }
        cloud = (response.data.favorites ?? []).filter(
          (id): id is string => typeof id === "string",
        );
      } catch (error) {
        // Keep what this tab has; the next toggle retries the load.
        console.warn("Couldn't load favorites from FireRoad:", error);
        return;
      }
      let merged = [...cloud];
      for (const id of local) {
        if (!merged.includes(id)) {
          merged.push(id);
        }
      }
      for (const [id, favorite] of Object.entries(this.editsBeforeLoad)) {
        merged = merged.filter((existing) => existing !== id);
        if (favorite) {
          merged.push(id);
        }
      }
      const changedByUs =
        merged.length !== cloud.length ||
        merged.some((id, i) => id !== cloud[i]);
      this.ids = merged;
      this.cloudLoaded = true;
      this.editsBeforeLoad = {};
      // The browser copy goes once the cloud has everything in it.
      if (!changedByUs || (await this.saveToCloud())) {
        removeValue(STORAGE_KEYS.favorites);
      }
    },
  },
});
