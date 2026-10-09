/**
 * The student's favorite subjects: an ordered list of subject ids, shown
 * at the top of the command palette before any search.
 *
 * Logged in, FireRoad holds the list (/prefs/favorites/,
 * /prefs/set_favorites/), shared with FireRoad's other clients. Logged
 * out, it lives in this browser, under the storage consent like
 * logged-out roads, and is merged into FireRoad on the next login.
 *
 * The sync itself is stores/cloudSync.ts, shared with notes.
 */

import { defineStore } from "pinia";
import { STORAGE_KEYS, readValue } from "../lib/appStorage";
import { createCloudSync, type SyncedState } from "./cloudSync";
import { fireroad } from "./fireroadClient";

function readLocalFavorites(): string[] {
  const stored = readValue<string[]>(STORAGE_KEYS.favorites);
  return Array.isArray(stored)
    ? stored.filter((id): id is string => typeof id === "string")
    : [];
}

interface FavoritesState extends SyncedState<boolean> {
  /** Subject ids, oldest favorite first. */
  ids: string[];
}

const sync = createCloudSync<string[], boolean, FavoritesState>({
  name: "favorites",
  storageKey: STORAGE_KEYS.favorites,
  readLocal: readLocalFavorites,
  current: (store) => [...store.ids],
  replace: (store, ids) => {
    store.ids = ids;
  },
  async fetchCloud() {
    const response = await fireroad.getFavorites();
    if (!response.data.success) {
      throw new Error(response.data.error ?? "favorites failed");
    }
    return (response.data.favorites ?? []).filter(
      (id): id is string => typeof id === "string",
    );
  },
  async saveCloud(ids) {
    const response = await fireroad.setFavorites(ids);
    if (!response.data.success) {
      throw new Error(response.data.error ?? "set_favorites failed");
    }
  },
  // Favorites made logged out are appended, in their order; toggles made
  // while the fetch was in flight win.
  merge(cloud, local, edits) {
    let merged = [...cloud];
    for (const id of local) {
      if (!merged.includes(id)) {
        merged.push(id);
      }
    }
    for (const [id, favorite] of Object.entries(edits)) {
      merged = merged.filter((existing) => existing !== id);
      if (favorite) {
        merged.push(id);
      }
    }
    const changed =
      merged.length !== cloud.length || merged.some((id, i) => id !== cloud[i]);
    return { value: merged, changed };
  },
  saveFailed: [
    "Couldn't save your favorites",
    "They're kept in this tab and will be saved with your next change.",
  ],
});

export const useFavoritesStore = defineStore("favorites", {
  state: (): FavoritesState => ({
    ids: readLocalFavorites(),
    cloudLoaded: false,
    editsBeforeLoad: {},
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
      sync.afterEdit(this, subjectId, favorite);
    },

    toggleFavorite(subjectId: string) {
      this.setFavorite(subjectId, !this.isFavorite(subjectId));
    },

    /** After login: fetch the cloud list and fold in local changes. */
    loadFromCloud(): Promise<void> {
      return sync.load(this);
    },
  },
});
