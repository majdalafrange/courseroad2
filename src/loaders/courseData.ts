/**
 * Pinia Colada queries for the subject catalog and requirements list.
 * The cache, cross-reload persistence (IndexedDB via idb-keyval), and
 * retry are Colada plugins wired in main.ts.
 *
 * Applying happens in a `watch(query.data, ...)`, not inside `query`:
 * data the cache persister restores lands in `data` without `query`
 * running.
 */
import { defineQuery, useQuery } from "@pinia/colada";
import { del } from "idb-keyval";
import { watch } from "vue";
import { fireroad } from "../stores/fireroadClient";
import { useAuditStore } from "../stores/audit";
import { useCourseDataStore } from "../stores/courseData";

// Institutional data that changes on its own schedule; a few minutes of
// staleness avoids a multi-MB refetch on every route mount.
const STALE_TIME = 5 * 60 * 1000;

/** Both queries are "fetch from FireRoad, apply to a store". */
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
      // Colada refetches on window focus by default; wasteful for a
      // multi-MB catalog.
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

/** Wipes the persisted cache (cookie-consent opt-out). Best-effort. */
export async function clearPersistedQueryCache(): Promise<void> {
  try {
    return await del(QUERY_CACHE_KEY);
  } catch {
    /* best-effort */
  }
}
