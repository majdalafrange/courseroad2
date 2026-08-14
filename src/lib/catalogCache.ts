/**
 * IndexedDB cache for the full FireRoad catalog (~6000 subjects, several
 * MB). Startup reads the cache for instant interactivity and refreshes
 * from the network in the background; the catalog fetch never blocks
 * first paint again.
 */

import type { Subject } from "./types";

const DB_NAME = "courseroad-catalog";
const DB_VERSION = 1;
const STORE = "catalog";
const KEY = "full-catalog";

interface CachedCatalog {
  subjects: Subject[];
  fetchedAt: number;
  sourceUrl: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Cached catalog, or undefined when absent or IndexedDB is unavailable. */
export async function loadCachedCatalog(): Promise<CachedCatalog | undefined> {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(KEY);
      request.onsuccess = () =>
        resolve(request.result as CachedCatalog | undefined);
      request.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}

/** Persist a fresh catalog; failures are swallowed (cache is best-effort). */
export async function saveCachedCatalog(
  subjects: Subject[],
  sourceUrl: string,
): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(
        { subjects, fetchedAt: Date.now(), sourceUrl } satisfies CachedCatalog,
        KEY,
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* best-effort */
  }
}

/** Drop the cache (used when the app version changes incompatibly). */
export async function clearCachedCatalog(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* best-effort */
  }
}
