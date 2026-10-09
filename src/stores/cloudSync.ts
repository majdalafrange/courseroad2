/**
 * Sync for favorites and notes, which FireRoad stores whole: set_* replaces
 * everything, so nothing is saved before the cloud copy has loaded.
 * Logged out, the value lives in this browser until the next login.
 */

import { toast } from "../design/toast";
import { type StorageKey, removeValue, writeValue } from "../lib/appStorage";
import { useCourseDataStore } from "./courseData";

const CLOUD_SAVE_DELAY_MS = 600;

/** The state a synced store keeps (as Pinia state, so it is reactive). */
export interface SyncedState<Edit> {
  /** Logged in: whether the cloud copy has arrived. */
  cloudLoaded: boolean;
  /** Edits made before it did, by key; they win over the cloud copy. */
  editsBeforeLoad: Record<string, Edit>;
}

export interface CloudSyncOptions<T, Edit, S extends SyncedState<Edit>> {
  /** Plural noun for console messages: "favorites", "notes". */
  name: string;
  storageKey: StorageKey;
  /** The browser copy; empty when absent or malformed. */
  readLocal: () => T;
  /** A copy of the store's current value, to save. */
  current: (store: S) => T;
  replace: (store: S, value: T) => void;
  /** Throws on any failure, FireRoad's `success: false` included. */
  fetchCloud: () => Promise<T>;
  saveCloud: (value: T) => Promise<void>;
  /**
   * Fold the browser copy and the pre-load edits into the cloud copy.
   * `changed` says the result differs from `cloud` and needs a save.
   */
  merge: (
    cloud: T,
    local: T,
    edits: Record<string, Edit>,
  ) => { value: T; changed: boolean };
  /** The toast when a save fails: title, then detail. */
  saveFailed: [string, string];
}

export interface CloudSync<S, Edit> {
  /** Persist after the store changed `key`; `edit` replays that change. */
  afterEdit: (store: S, key: string, edit: Edit) => void;
  /** After login: fetch, merge, and save if needed. One load at a time. */
  load: (store: S) => Promise<void>;
}

export function createCloudSync<T, Edit, S extends SyncedState<Edit>>(
  options: CloudSyncOptions<T, Edit, S>,
): CloudSync<S, Edit> {
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;

  async function save(store: S): Promise<boolean> {
    try {
      await options.saveCloud(options.current(store));
      return true;
    } catch (error) {
      console.warn(`Couldn't save ${options.name} to FireRoad:`, error);
      toast.warn(...options.saveFailed);
      return false;
    }
  }

  async function fetchAndMerge(store: S): Promise<void> {
    const local = options.readLocal();
    let cloud: T;
    try {
      cloud = await options.fetchCloud();
    } catch (error) {
      // Keep what this tab has; the next edit retries the load.
      console.warn(`Couldn't load ${options.name} from FireRoad:`, error);
      return;
    }
    const { value, changed } = options.merge(
      cloud,
      local,
      store.editsBeforeLoad,
    );
    options.replace(store, value);
    store.cloudLoaded = true;
    store.editsBeforeLoad = {};
    // The browser copy goes once the cloud has everything in it.
    if (!changed || (await save(store))) {
      removeValue(options.storageKey);
    }
  }

  function load(store: S): Promise<void> {
    inFlight ??= fetchAndMerge(store).finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  }

  function afterEdit(store: S, key: string, edit: Edit): void {
    const courseData = useCourseDataStore();
    if (!courseData.loggedIn) {
      if (courseData.cookiesAllowed) {
        writeValue(options.storageKey, options.current(store));
      }
      return;
    }
    if (!store.cloudLoaded) {
      store.editsBeforeLoad[key] = edit;
      void load(store);
      return;
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = undefined;
      void save(store);
    }, CLOUD_SAVE_DELAY_MS);
  }

  return { afterEdit, load };
}
