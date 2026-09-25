/**
 * Audit store: the FireRoad requirements list and per-program progress
 * trees for the active road, recomputed on courseData's road-change
 * notifications.
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
    /** Each program's official page; null if none or still loading. */
    programUrls: {} as Record<string, string | null>,
    updatingFulfillment: false,
    /** A recompute that arrived before the roads were hydrated; flushPendingFulfillment replays it. */
    pendingFulfillment: null as string | null,
    /** Programs whose last progress request failed; rendered with a retry. */
    failedPrograms: {} as Record<string, boolean>,
    /** Per-program request generation; only the latest response is applied. */
    fulfillmentGeneration: {} as Record<string, number>,
    /** What-if preview: a program tried against the road, uncommitted. */
    previewProgram: null as string | null,
    previewTree: null as RequirementNode | null,
    previewLoading: false,
    /**
     * Expansion state for the audit tree, kept here so it survives a
     * section or row unmounting (a closed branch, a road switch and back).
     * Branch rows are keyed programKey + "/" + list-id, program headers by
     * programKey. An absent key means the render default applies. In
     * memory only.
     */
    expanded: {} as Record<string, boolean>,
  }),
  getters: {
    /** Whether a requirement group is open. Groups start closed until
     *  opened. Key: programKey + "/" + list-id. */
    isNodeOpen:
      (state) =>
      (key: string): boolean =>
        state.expanded[key] ?? false,
  },
  actions: {
    /** Record one expansion entry. Key: programKey + "/" + list-id. */
    setNode(key: string, open: boolean) {
      this.expanded[key] = open;
    },

    /** Fetch a program's official page once; a failure retries on the
     *  next recompute. */
    loadProgramUrl(key: string) {
      if (key in this.programUrls) {
        return;
      }
      this.programUrls[key] = null;
      void Promise.resolve()
        .then(() => fireroad.getRequirementDefinition(key))
        .then((response) => {
          this.programUrls[key] = response.data.url ?? null;
        })
        .catch(() => {
          delete this.programUrls[key];
        });
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
      this.loadProgramUrl(programKey);
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
        // Roads not hydrated yet (boot), or between a delete and the next
        // switch: hold the request for replay.
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
        this.loadProgramUrl(req);
        const alteredRoadContents = formatRoadContents(activeRoad.contents);
        delete this.failedPrograms[req];
        const generation = (this.fulfillmentGeneration[req] ?? 0) + 1;
        this.fulfillmentGeneration[req] = generation;
        fireroad
          .getProgress(req, alteredRoadContents)
          .then((response) => {
            // A later edit re-requested this program; this response is stale.
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
      // Release once this batch has been dispatched.
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
