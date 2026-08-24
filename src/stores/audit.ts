/**
 * Audit store: the FireRoad requirements list and per-program progress
 * trees for the active road. Extracted from MainPage.vue; recomputation
 * is triggered through courseData's road-change notifications instead of
 * the old deep watcher.
 */

import { defineStore } from "pinia";
import type { ReqListEntry, RequirementNode } from "../lib/types";
import { formatRoadContents } from "../lib/roads";
import { fireroad } from "./fireroadClient";
import { useCourseDataStore } from "./courseData";

export const useAuditStore = defineStore("audit", {
  state: () => ({
    reqList: [
      // add a dummy entry so the audit tree renders something before first fetch is done
      {
        key: "girs",
        "short-title": "GIRs",
        "medium-title": "GIRs",
        "title-no-degree": "",
        title: "General Institute Requirements",
      },
    ] as ReqListEntry[],
    reqTrees: {} as Record<string, RequirementNode>,
    updatingFulfillment: false,
    /**
     * A recompute that arrived before the roads were hydrated. Held here
     * instead of being dropped; flushPendingFulfillment replays it once
     * the active road exists (auth.restoreFromStorage calls it after
     * restoring logged-out roads).
     */
    pendingFulfillment: null as string | null,
    /**
     * Programs whose last progress request failed (an unresolvable key,
     * or FireRoad unreachable). Keyed by program; the audit renders these
     * as a terminal state with a retry instead of "computing..." forever.
     */
    failedPrograms: {} as Record<string, boolean>,
    /**
     * Per-program request generation, bumped on each (re-)request. A
     * response is applied only if it's still the latest for that program,
     * so an out-of-order reply can't clobber fresher data (mirrors
     * startPreview's own guard, below).
     */
    fulfillmentGeneration: {} as Record<string, number>,
    /** What-if preview: a program tried against the road, uncommitted. */
    previewProgram: null as string | null,
    previewTree: null as RequirementNode | null,
    previewLoading: false,
    /**
     * Expansion state for the audit tree, held here so it survives the
     * detail panel swapping in and out. Branch rows are keyed
     * programKey + "/" + list-id (list-id is stable within a program;
     * uniqueKey renumbers when a program is removed). Program headers
     * are keyed by programKey alone. An absent key means the render
     * default applies: depth < 1 for branches, first program only for
     * program headers. In memory only; persisting across reload would
     * mean extending the persistedStore allowlist.
     */
    expanded: {} as Record<string, boolean>,
  }),
  actions: {
    /** Record one expansion entry. Key: programKey + "/" + list-id. */
    setNode(key: string, open: boolean) {
      this.expanded[key] = open;
    },

    /** Bulk set, for expand all and collapse all. */
    setNodes(keys: string[], open: boolean) {
      for (const key of keys) {
        this.expanded[key] = open;
      }
    },

    /** Try a program against the current road without committing it. */
    async startPreview(programKey: string) {
      const store = useCourseDataStore();
      const activeRoad = store.roads[store.activeRoad];
      if (activeRoad === undefined) {
        return;
      }
      this.previewProgram = programKey;
      this.previewTree = null;
      this.previewLoading = true;
      try {
        const response = await fireroad.getProgress(
          programKey,
          formatRoadContents(activeRoad.contents),
        );
        // Discard stale responses if the preview changed meanwhile
        if (this.previewProgram === programKey) {
          this.previewTree = response.data;
        }
      } catch (e) {
        console.warn(`Preview fetch failed for ${programKey}:`, e);
        if (this.previewProgram === programKey) {
          this.clearPreview();
        }
      } finally {
        this.previewLoading = false;
      }
    },

    clearPreview() {
      this.previewProgram = null;
      this.previewTree = null;
      this.previewLoading = false;
    },

    /** Commit the previewed program to the road. */
    keepPreview() {
      const store = useCourseDataStore();
      if (this.previewProgram !== null) {
        store.addReq(this.previewProgram);
        this.clearPreview();
      }
    },

    /** Applies a fetched requirements list; the fetch itself is
     * loaders/courseData.ts's useReqListLoader, a Pinia Colada query. */
    applyReqList(data: Record<string, Omit<ReqListEntry, "key">>) {
      this.reqList = Object.keys(data)
        .map((m) => Object.assign(data[m], { key: m }))
        .sort() as ReqListEntry[];
    },

    /**
     * Recompute fulfillment via the FireRoad progress API.
     * fulfillmentNeeded: "all" (every program on the active road),
     * a program key, or "none".
     */
    updateFulfillment(fulfillmentNeeded: string) {
      const store = useCourseDataStore();
      if (this.updatingFulfillment || fulfillmentNeeded === "none") {
        return;
      }
      const activeRoad = store.roads[store.activeRoad];
      if (activeRoad === undefined) {
        // Called before the roads were hydrated (boot ordering) or between
        // a delete and the switch to the next road. Hold the request so
        // hydration can replay it instead of scoring an absent road.
        this.pendingFulfillment =
          this.pendingFulfillment === null ||
          this.pendingFulfillment === fulfillmentNeeded
            ? fulfillmentNeeded
            : "all";
        return;
      }
      this.pendingFulfillment = null;
      this.updatingFulfillment = true;
      const fulfillments =
        fulfillmentNeeded === "all"
          ? activeRoad.contents.coursesOfStudy
          : [fulfillmentNeeded];
      for (const req of fulfillments) {
        const alteredRoadContents = formatRoadContents(activeRoad.contents);
        delete this.failedPrograms[req];
        const generation = (this.fulfillmentGeneration[req] ?? 0) + 1;
        this.fulfillmentGeneration[req] = generation;
        fireroad
          .getProgress(req, alteredRoadContents)
          .then((response) => {
            // A later edit already re-requested this program; that
            // request's own response will land and this one is stale.
            if (this.fulfillmentGeneration[req] !== generation) {
              return;
            }
            this.reqTrees[req] = response.data;
            delete this.failedPrograms[req];
          })
          .catch((e) => {
            if (this.fulfillmentGeneration[req] !== generation) {
              return;
            }
            console.warn(`Progress fetch failed for ${req}:`, e);
            this.failedPrograms[req] = true;
          });
      }
      // Mirror the legacy nextTick release: allow the next change to
      // recompute once this batch has been dispatched.
      void Promise.resolve().then(() => {
        this.updatingFulfillment = false;
      });
      // A road change invalidates the what-if preview too.
      if (this.previewProgram !== null) {
        void this.startPreview(this.previewProgram);
      }
    },

    /** Replay a recompute that arrived before the roads were hydrated. */
    flushPendingFulfillment() {
      if (this.pendingFulfillment !== null) {
        const pending = this.pendingFulfillment;
        this.pendingFulfillment = null;
        this.updateFulfillment(pending);
      }
    },
  },
});
