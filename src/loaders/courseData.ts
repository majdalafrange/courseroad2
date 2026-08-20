/**
 * Pinia Colada queries for the subject catalog and requirements list.
 * Colada owns what courseData.ts used to hand-roll: the in-memory cache,
 * cross-reload persistence (the cache persister, IndexedDB via
 * idb-keyval), and retry on a failed fetch (both plugins wired in
 * main.ts). This file is left with just the fetch and where it's applied.
 *
 * Applying happens in a `watch(query.data, ...)`, not inside `query`
 * itself: `query` only reruns on an actual fetch, but data the cache
 * persister restores (a returning visit, still fresh) lands in `data`
 * without `query` ever running, and that path needs the store updated too.
 */
import { defineQuery, useQuery } from "@pinia/colada";
import { del } from "idb-keyval";
import { watch } from "vue";
import { fireroad } from "../stores/fireroadClient";
import { useAuditStore } from "../stores/audit";
import { useCourseDataStore } from "../stores/courseData";

// Institutional data (the catalog, requirement trees) that changes on
// its own schedule, not the user's; a few minutes of staleness avoids a
// multi-MB refetch every time a route mounts without going stale for a
// whole session.
const STALE_TIME = 5 * 60 * 1000;

/** Both queries here are "fetch from FireRoad, apply to a store" with
 * nothing else distinguishing them; this is that shape once. */
function defineCatalogQuery<Data>(
  key: string,
  fetch: () => Promise<Data>,
  apply: (data: Data) => void,
) {
  return defineQuery(() => {
    const query = useQuery({
      key: [key],
      query: fetch,
      staleTime: STALE_TIME,
      // Colada's default refetches on window focus; fine for a user's
      // own data, wasteful for a multi-MB catalog that doesn't change
      // out from under a session just because the tab did.
      refetchOnWindowFocus: false,
    });
    watch(
      query.data,
      (data) => {
        if (data !== undefined) {
          apply(data);
        }
      },
      { immediate: true },
    );
    return query;
  });
}

export const useSubjectsLoader = defineCatalogQuery(
  "subjects",
  async () => (await fireroad.getFullCatalog()).data,
  (subjects) => useCourseDataStore().applyCatalog(subjects),
);

export const useReqListLoader = defineCatalogQuery(
  "reqList",
  async () => (await fireroad.getRequirementsList()).data,
  (data) => useAuditStore().applyReqList(data),
);

/** Storage key the cache persister (see main.ts) keeps both queries under. */
export const QUERY_CACHE_KEY = "courseroad-query-cache";

/** Wipes the persisted cache; used on cookie-consent opt-out. Best-effort,
 * matching the storage layer it replaced. */
export async function clearPersistedQueryCache(): Promise<void> {
  try {
    return await del(QUERY_CACHE_KEY);
  } catch {
    /* best-effort */
  }
}
