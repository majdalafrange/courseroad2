/**
 * Degree-fit store: runs the active road against every major/minor,
 * holds the ranked outcome. One `/requirements/progress/` call per
 * program (the same endpoint the audit panel uses): ~133 requests, so
 * this only runs on an explicit click, at bounded concurrency, cached
 * against a fingerprint of the road so reopening an unchanged plan costs
 * nothing. Ordering/grouping/failure classification live in
 * `lib/degreeFit.ts`; this layer owns network, cancellation, staleness.
 */

import { computed, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import {
  groupFits,
  roadFingerprint,
  scannablePrograms,
  toFit,
  type FitGroups,
  type ProgramFit,
  type ProgramProbe,
} from "../lib/degreeFit";
import { formatRoadContents } from "../lib/roads";
import { fireroad } from "./fireroadClient";
import { useAuditStore } from "./audit";
import { useCourseDataStore } from "./courseData";

export type DegreeFitStatus = "idle" | "scanning" | "ready" | "error";

/**
 * Simultaneous requests in flight. Six keeps a full scan near ten seconds
 * on a warm connection without opening 133 sockets at a shared service.
 */
const CONCURRENCY = 6;

const EMPTY_GROUPS: FitGroups = {
  majors: [],
  minors: [],
  unranked: [],
  failed: [],
};

/** Short, human-readable reason a single program could not be measured. */
function describeError(error: unknown): string {
  const response = (
    error as { response?: { status?: number; data?: unknown } } | undefined
  )?.response;
  if (response?.status !== undefined) {
    // A bad program key answers 400 with a plain-text body, not JSON, so
    // this reads `data` only when it is already a short string.
    const body = response.data;
    if (typeof body === "string" && body.length > 0 && body.length <= 200) {
      return `${response.status}: ${body}`;
    }
    return `FireRoad responded ${response.status}`;
  }
  return "No response from FireRoad";
}

/** Run `task` over `items`, at most `limit` at a time, in order. */
async function pooled<T>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      for (;;) {
        const index = cursor++;
        if (index >= items.length) {
          return;
        }
        await task(items[index], index);
      }
    })(),
  );
  await Promise.all(workers);
}

export const useDegreeFitStore = defineStore("degreeFit", () => {
  const courseData = useCourseDataStore();
  const audit = useAuditStore();

  const status = ref<DegreeFitStatus>("idle");
  const groups = shallowRef<FitGroups>(EMPTY_GROUPS);
  const completed = ref(0);
  const total = ref(0);
  /** Fingerprint of the road the held results describe. */
  const scannedRoad = ref<string | undefined>(undefined);
  /** Reason the scan as a whole could not start. */
  const error = ref<string | undefined>(undefined);

  /**
   * Bumped by every `scan()` and by `cancel()`. A worker whose token no
   * longer matches has been superseded and must not write results.
   */
  let scanToken = 0;

  const scanning = computed(() => status.value === "scanning");
  const percentDone = computed(() =>
    total.value === 0 ? 0 : Math.round((completed.value / total.value) * 100),
  );
  const rankedCount = computed(
    () => groups.value.majors.length + groups.value.minors.length,
  );

  /** Fingerprint of the road as it stands right now, if there is one. */
  function currentFingerprint(): string | undefined {
    const road = courseData.activeRoadObject;
    if (road === undefined) {
      return undefined;
    }
    return roadFingerprint(formatRoadContents(road.contents));
  }

  /** Held results no longer describe the road on screen. */
  const stale = computed(() => {
    if (status.value !== "ready" || scannedRoad.value === undefined) {
      return false;
    }
    return scannedRoad.value !== currentFingerprint();
  });

  function cancel(): void {
    scanToken += 1;
    if (status.value === "scanning") {
      status.value = scannedRoad.value === undefined ? "idle" : "ready";
    }
  }

  function reset(): void {
    scanToken += 1;
    status.value = "idle";
    groups.value = EMPTY_GROUPS;
    completed.value = 0;
    total.value = 0;
    scannedRoad.value = undefined;
    error.value = undefined;
  }

  /**
   * Measure every major and minor against the active road.
   *
   * Returns early when the held results already describe this exact road,
   * unless `force` is set.
   */
  async function scan(force = false): Promise<void> {
    const road = courseData.activeRoadObject;
    if (road === undefined) {
      status.value = "error";
      error.value = "No road is open";
      return;
    }

    const contents = formatRoadContents(road.contents);
    const fingerprint = roadFingerprint(contents);
    if (
      !force &&
      status.value === "ready" &&
      scannedRoad.value === fingerprint
    ) {
      return;
    }

    const token = ++scanToken;
    status.value = "scanning";
    error.value = undefined;
    completed.value = 0;
    total.value = 0;

    if (audit.reqList.length === 0) {
      try {
        await audit.loadReqList();
      } catch {
        if (token !== scanToken) {
          return;
        }
        status.value = "error";
        error.value = "The program list did not load";
        return;
      }
    }
    if (token !== scanToken) {
      return;
    }

    const programs = scannablePrograms(audit.reqList);
    if (programs.length === 0) {
      status.value = "error";
      error.value = "FireRoad listed no majors or minors";
      return;
    }

    const onRoad = new Set(road.contents.coursesOfStudy);
    const fits: ProgramFit[] = new Array(programs.length);
    total.value = programs.length;

    await pooled(programs, CONCURRENCY, async (entry, index) => {
      if (token !== scanToken) {
        return;
      }
      let probe: ProgramProbe;
      try {
        const response = await fireroad.getProgress(entry.key, contents);
        probe = { ok: true, tree: response.data };
      } catch (e) {
        probe = { ok: false, error: describeError(e) };
      }
      if (token !== scanToken) {
        return;
      }
      fits[index] = toFit(entry, probe, onRoad.has(entry.key));
      completed.value += 1;
    });

    if (token !== scanToken) {
      return;
    }

    groups.value = groupFits(fits.filter((fit) => fit !== undefined));
    scannedRoad.value = fingerprint;
    status.value = "ready";
  }

  return {
    status,
    groups,
    completed,
    total,
    error,
    scannedRoad,
    scanning,
    percentDone,
    rankedCount,
    stale,
    scan,
    cancel,
    reset,
  };
});
