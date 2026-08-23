/**
 * Central app store (Pinia port of the legacy Vuex store). State shape
 * mirrors the Vuex original field-for-field: the whole state is
 * serialized to localStorage ("courseRoadStore") on unload, so existing
 * users' snapshots must keep working. The legacy deep `roads` watcher
 * (autosave + audit recompute on every nested change) is replaced by
 * explicit `notifyRoadChange` calls per mutating action: targeted and
 * debounced instead of cascade-triggered.
 */

import { defineStore } from "pinia";
import type {
  CatalogView,
  ProgressAssertion,
  Road,
  SelectedSubject,
  Subject,
} from "../lib/types";
import {
  APP_VERSION,
  STORAGE_KEYS,
  readRawFlag,
  writeRawFlag,
} from "../lib/appStorage";
import { formatFireroadDate } from "../lib/dates";
import { buildIndex, parseGenericCourses } from "../lib/genericCourses";
import {
  DEFAULT_ROAD_ID,
  DEFAULT_ROAD_NAME,
  emptySelectedSubjects,
  migrateOldSubjects,
} from "../lib/roads";
import {
  persistedPanelSide,
  persistedThemeMode,
  sanitizePersistedStore,
  type PanelSide,
  type ThemeMode,
} from "../lib/persistedStore";
import { systemPrefersDark } from "../design/tokens";
import { bucketName, userYearFromSemester } from "../lib/offering";
import { history, setHistoryRoadFocus } from "./history";

export interface RoadChangeEvent {
  /** "all" | "none" | a specific program key. */
  fulfillment: string;
  /** Whether this change should trigger an autosave. */
  save: boolean;
  /** The road that changed (defaults to the active road). */
  roadID?: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type RoadChangeSubscriber = (event: RoadChangeEvent) => void;
const roadChangeSubscribers: RoadChangeSubscriber[] = [];

/** Subscribe to road changes (autosave + audit recompute hook). */
export function onRoadChange(subscriber: RoadChangeSubscriber): void {
  roadChangeSubscribers.push(subscriber);
}

/**
 * When a locally-created road's temporary key (`$defaultroad$` or a client
 * id) is swapped for its server id, `resetID` records the mapping here.
 * History undo/redo closures capture the road key at record time, so after
 * a resetID they'd otherwise dereference a now-deleted key and silently
 * no-op while the undo stack still advances. The low-level `*Raw` mutators
 * resolve their road key through this alias so replayed history lands on
 * the live road. Kept at module scope (not in the serialized store state)
 * because it is session-only, like the undo stacks themselves.
 */
const roadIdAlias = new Map<string, string>();

/** Follow the alias chain to a road's renamed-to key (cycle-guarded). */
function followAlias(id: string): string {
  let current = id;
  for (let hops = 0; hops < 32 && roadIdAlias.has(current); hops++) {
    current = roadIdAlias.get(current)!;
  }
  return current;
}

const getDefaultState = () => {
  // Scope the id-alias table to the store instance's lifetime. It runs once
  // when the store's state is created (page load, or a fresh Pinia in tests)
  // and never again mid-session ($patch/setFromLocalStorage don't re-run
  // this factory), so live resetID mappings survive a session but never leak
  // across store instances.
  roadIdAlias.clear();
  return {
    versionNumber: APP_VERSION, // change when making backwards-incompatible changes
    currentSemester: 1,
    activeRoad: DEFAULT_ROAD_ID,
    addingFromCard: false,
    classInfoStack: [] as string[],
    activeClassIndex: 0,
    cookiesAllowed: undefined as boolean | undefined,
    customClassEditing: undefined as SelectedSubject | undefined,
    genericCourses: [] as Subject[],
    genericIndex: {} as Record<string, number>,
    itemAdding: undefined as Subject | undefined,
    loggedIn: false,
    // Guarded access: this factory runs at store construction, and a bare
    // localStorage read here crashed the whole boot where storage throws
    // (Safari private mode).
    hideIAP: readRawFlag(STORAGE_KEYS.hideIAP),
    roads: {
      [DEFAULT_ROAD_ID]: {
        downloaded: formatFireroadDate(),
        changed: formatFireroadDate(),
        name: DEFAULT_ROAD_NAME,
        agent: "",
        contents: {
          coursesOfStudy: ["girs"],
          selectedSubjects: emptySelectedSubjects(),
          progressOverrides: {},
          progressAssertions: {},
        },
      },
    } as Record<string, Road>,
    subjectsIndex: {} as Record<string, number>,
    subjectsInfo: [] as Subject[],
    ignoreRoadChanges: false,
    // When changes are made to roads, different levels of fulfillment need
    // to be updated in the audit:
    //   all: update audit for all programs (e.g. after adding a class)
    //   {program}: update audit for one program (after adding that program)
    //   none: no update needed (e.g. after renaming a road)
    fulfillmentNeeded: "all",
    // road IDs that have not been retrieved from the server yet
    unretrieved: [] as string[],
    subjectsLoaded: false,
    roadsToMigrate: [] as string[],
    themeMode: persistedThemeMode() as ThemeMode,
    // The live OS/browser preference for light/dark mode, used to resolve themeMode === "system".
    systemPrefersDark: systemPrefersDark(),
    // Which side the audit panel (plan) and node panel (explore) render on.
    panelSide: persistedPanelSide() as PanelSide,
  };
};

export const useCourseDataStore = defineStore("courseData", {
  state: getDefaultState,
  getters: {
    userYear(state): number {
      return userYearFromSemester(state.currentSemester);
    },
    catalog(state): CatalogView {
      return {
        subjectsInfo: state.subjectsInfo as Subject[],
        subjectsIndex: state.subjectsIndex,
        genericCourses: state.genericCourses as Subject[],
        genericIndex: state.genericIndex,
      };
    },
    activeRoadObject(state): Road | undefined {
      return state.roads[state.activeRoad];
    },
    /** The effective light/dark state: themeMode resolved against the
        live OS preference when it's "system". */
    isDarkMode(state): boolean {
      return state.themeMode === "system"
        ? state.systemPrefersDark
        : state.themeMode === "dark";
    },
    hasGIRReqList(state): boolean {
      const activeRoad = state.roads[state.activeRoad];
      return (
        activeRoad !== undefined &&
        activeRoad.contents.coursesOfStudy.includes("girs")
      );
    },
  },
  actions: {
    /** Notify autosave/audit subscribers of a road change. */
    notifyRoadChange(event: RoadChangeEvent) {
      // Consent comes only from the banner (or a prior session's cookies);
      // editing a road does not grant it.
      for (const subscriber of roadChangeSubscribers) {
        subscriber(event);
      }
    },

    resetState() {
      Object.assign(this.$state, getDefaultState());
    },

    /** Low-level class splice: mutate + notify, no history recording. */
    /**
     * The current storage key for a (possibly stale) captured road key. If
     * the key is still a live road, use it directly; only a key that
     * resetID renamed away (and is now absent) follows the alias chain. This
     * is what makes history closures survive a temp→server id swap WITHOUT
     * misdirecting edits when a temp key like "$0$" is later reused for a
     * brand-new road.
     */
    liveRoadKey(id: string): string {
      return id in this.roads ? id : followAlias(id);
    },

    spliceClassRaw(
      roadID: string,
      semester: number,
      index: number,
      deleteCount: number,
      item?: SelectedSubject,
    ) {
      roadID = this.liveRoadKey(roadID);
      const road = this.roads[roadID];
      if (road === undefined) {
        return;
      }
      if (item !== undefined) {
        road.contents.selectedSubjects[semester].splice(
          index,
          deleteCount,
          item,
        );
      } else {
        road.contents.selectedSubjects[semester].splice(index, deleteCount);
      }
      road.changed = formatFireroadDate();
      this.notifyRoadChange({ fulfillment: "all", save: true, roadID });
    },

    /** Low-level class move: mutate + notify, no history recording. */
    moveClassRaw(
      roadID: string,
      fromSemester: number,
      fromIndex: number,
      toSemester: number,
    ) {
      roadID = this.liveRoadKey(roadID);
      const road = this.roads[roadID];
      if (road === undefined) {
        return;
      }
      const [moved] = road.contents.selectedSubjects[fromSemester].splice(
        fromIndex,
        1,
      );
      if (moved === undefined) {
        return;
      }
      moved.semester = toSemester;
      road.contents.selectedSubjects[toSemester].push(moved);
      road.changed = formatFireroadDate();
      this.notifyRoadChange({ fulfillment: "all", save: true, roadID });
    },

    addClass(newClass: SelectedSubject) {
      const roadID = this.activeRoad;
      if (!(roadID in this.roads)) {
        // No active road (e.g. every road was just deleted and the /explore
        // placement flow is still reachable): drop the add instead of
        // dereferencing this.roads[""] and throwing.
        return;
      }
      const semester = newClass.semester;
      this.roads[roadID].contents.selectedSubjects[semester].push(newClass);
      this.roads[roadID].changed = formatFireroadDate();
      this.notifyRoadChange({ fulfillment: "all", save: true, roadID });
      const index =
        this.roads[roadID].contents.selectedSubjects[semester].length - 1;
      const snapshot = clone(newClass);
      history.record(
        `Added ${newClass.subject_id} to ${bucketName(semester)}`,
        () => this.spliceClassRaw(roadID, semester, index, 1),
        () => this.spliceClassRaw(roadID, semester, index, 0, clone(snapshot)),
        roadID,
      );
    },

    addFromCard(classItem: Subject) {
      this.addingFromCard = true;
      this.itemAdding = classItem;
    },

    addReq(event: string) {
      const roadID = this.activeRoad;
      if (this.roads[roadID].contents.coursesOfStudy.includes(event)) {
        // Already on the road: a stale "undo" toast for this same program
        // (clicked after the program was independently re-added through
        // the picker) would otherwise push a second copy, giving two
        // program-section rows the same v-for key.
        return;
      }
      this.roads[roadID].contents.coursesOfStudy.push(event);
      this.roads[roadID].changed = formatFireroadDate();
      this.fulfillmentNeeded = event;
      this.notifyRoadChange({ fulfillment: event, save: true, roadID });
      history.record(
        `Added program ${event}`,
        () => this.removeReqRaw(roadID, event),
        () => this.addReqRaw(roadID, event),
        roadID,
      );
    },

    addReqRaw(roadID: string, event: string) {
      roadID = this.liveRoadKey(roadID);
      const road = this.roads[roadID];
      if (road === undefined) {
        return;
      }
      road.contents.coursesOfStudy.push(event);
      road.changed = formatFireroadDate();
      this.fulfillmentNeeded = event;
      this.notifyRoadChange({ fulfillment: event, save: true, roadID });
    },

    removeReqRaw(roadID: string, event: string) {
      roadID = this.liveRoadKey(roadID);
      const road = this.roads[roadID];
      if (road === undefined) {
        return;
      }
      const reqIndex = road.contents.coursesOfStudy.indexOf(event);
      if (reqIndex === -1) {
        return;
      }
      road.contents.coursesOfStudy.splice(reqIndex, 1);
      road.changed = formatFireroadDate();
      this.fulfillmentNeeded = "none";
      this.notifyRoadChange({ fulfillment: "none", save: true, roadID });
    },

    migrateOldSubjects(roadID: string) {
      migrateOldSubjects(this.roads[roadID], this.catalog);
      this.notifyRoadChange({ fulfillment: "all", save: true });
    },

    allowCookies() {
      this.cookiesAllowed = true;
    },

    disallowCookies() {
      this.cookiesAllowed = false;
    },

    cancelAddFromCard() {
      this.addingFromCard = false;
      this.itemAdding = undefined;
    },

    cancelEditCustomClass() {
      this.customClassEditing = undefined;
    },

    clearClassInfoStack() {
      this.classInfoStack = [];
      this.activeClassIndex = 0;
    },

    deleteRoad(id: string) {
      delete this.roads[id];
      // Legacy parity: deletion recomputed fulfillment but never saved
      // the deletion itself (the server delete is a separate call).
      this.notifyRoadChange({ fulfillment: "all", save: false });
    },

    dragStartClass(event: {
      classInfo?: Subject;
      basicClass?: { subject_id: string };
    }) {
      let classInfo = event.classInfo;
      if (classInfo === undefined && event.basicClass !== undefined) {
        if (event.basicClass.subject_id in this.subjectsIndex) {
          classInfo =
            this.subjectsInfo[this.subjectsIndex[event.basicClass.subject_id]];
        } else if (event.basicClass.subject_id in this.genericIndex) {
          classInfo =
            this.genericCourses[this.genericIndex[event.basicClass.subject_id]];
        }
      }
      this.itemAdding = classInfo;
      this.addingFromCard = false;
    },

    editCustomClass(classItem: SelectedSubject) {
      this.customClassEditing = classItem;
    },

    finishEditCustomClass(newClass: Subject) {
      const editing = this.customClassEditing as SelectedSubject | undefined;
      if (editing === undefined) {
        return;
      }
      const roadID = this.activeRoad;
      const road = this.roads[roadID];
      if (road === undefined) {
        this.customClassEditing = undefined;
        return;
      }
      // Locate the class positionally (semester, index) rather than by the
      // `editing` object reference: an intervening add/remove undo/redo
      // reinserts a clone(), so the reference goes stale, but the position is
      // valid at undo time because LIFO undoes every later action first. The
      // edit never changes the semester, so the bucket is stable.
      const semester = editing.semester;
      const classIndex =
        road.contents.selectedSubjects[semester].indexOf(editing);
      if (classIndex < 0) {
        this.customClassEditing = undefined;
        return;
      }
      const attrs = [
        "subject_id",
        "title",
        "in_class_hours",
        "out_of_class_hours",
        "custom_color",
        "public",
        "offered_fall",
        "offered_IAP",
        "offered_spring",
        "offered_summer",
      ];
      const editingRec = editing as unknown as Record<string, unknown>;
      const source = newClass as unknown as Record<string, unknown>;
      const before: Record<string, unknown> = { units: editingRec.units };
      const after: Record<string, unknown> = { units: newClass.total_units };
      for (const attr of attrs) {
        before[attr] = editingRec[attr];
        after[attr] = source[attr];
      }
      const apply = (vals: Record<string, unknown>) => {
        const r = this.roads[this.liveRoadKey(roadID)];
        const cls = r?.contents.selectedSubjects[semester]?.[
          classIndex
        ] as unknown as Record<string, unknown> | undefined;
        if (cls === undefined) {
          return;
        }
        for (const attr of attrs) {
          cls[attr] = vals[attr];
        }
        cls.units = vals.units;
        r!.changed = formatFireroadDate();
        this.notifyRoadChange({
          fulfillment: "all",
          save: true,
          roadID: this.liveRoadKey(roadID),
        });
      };
      apply(after);
      this.customClassEditing = undefined;
      history.record(
        `Edited ${newClass.subject_id}`,
        () => apply(before),
        () => apply(after),
        roadID,
      );
    },

    moveClass({
      currentClass,
      classIndex,
      semester,
    }: {
      currentClass: SelectedSubject;
      classIndex: number;
      semester: number;
    }) {
      const roadID = this.activeRoad;
      const fromSemester = currentClass.semester;
      this.moveClassRaw(roadID, fromSemester, classIndex, semester);
      const toIndex =
        this.roads[roadID].contents.selectedSubjects[semester].length - 1;
      history.record(
        `Moved ${currentClass.subject_id} to ${bucketName(semester)}`,
        () =>
          this.moveBackRaw(roadID, semester, toIndex, fromSemester, classIndex),
        () => this.moveClassRaw(roadID, fromSemester, classIndex, semester),
        roadID,
      );
    },

    /** Inverse of moveClassRaw: reinsert at the original index. */
    moveBackRaw(
      roadID: string,
      fromSemester: number,
      fromIndex: number,
      toSemester: number,
      toIndex: number,
    ) {
      roadID = this.liveRoadKey(roadID);
      const road = this.roads[roadID];
      if (road === undefined) {
        return;
      }
      const [moved] = road.contents.selectedSubjects[fromSemester].splice(
        fromIndex,
        1,
      );
      if (moved === undefined) {
        return;
      }
      moved.semester = toSemester;
      road.contents.selectedSubjects[toSemester].splice(toIndex, 0, moved);
      road.changed = formatFireroadDate();
      this.notifyRoadChange({ fulfillment: "all", save: true, roadID });
    },

    /**
     * Low-level warning-override toggle on a placed class, located by
     * (semester, index), NOT object identity. add/remove undo/redo reinsert
     * clone()s, so an identity lookup would miss the class after an
     * intervening remove+undo; a positional lookup is valid because the LIFO
     * history undoes every later action first, restoring the position.
     */
    setOverrideWarningsRaw(
      roadID: string,
      semester: number,
      classIndex: number,
      override: boolean,
    ) {
      const road = this.roads[this.liveRoadKey(roadID)];
      if (road === undefined) {
        return;
      }
      const cls = road.contents.selectedSubjects[semester]?.[classIndex];
      if (cls === undefined) {
        return;
      }
      cls.overrideWarnings = override;
      road.changed = formatFireroadDate();
      this.notifyRoadChange({
        fulfillment: "all",
        save: true,
        roadID: this.liveRoadKey(roadID),
      });
    },

    overrideWarnings(payload: {
      classInfo: SelectedSubject;
      override: boolean;
    }) {
      const roadID = this.activeRoad;
      const road = this.roads[roadID];
      if (road === undefined) {
        return;
      }
      const semester = payload.classInfo.semester;
      const classIndex = road.contents.selectedSubjects[semester].indexOf(
        payload.classInfo,
      );
      if (classIndex < 0) {
        return;
      }
      const before = payload.classInfo.overrideWarnings;
      if (before === payload.override) {
        return;
      }
      this.setOverrideWarningsRaw(
        roadID,
        semester,
        classIndex,
        payload.override,
      );
      history.record(
        payload.override ? "Overrode warnings" : "Restored warnings",
        () => this.setOverrideWarningsRaw(roadID, semester, classIndex, before),
        () =>
          this.setOverrideWarningsRaw(
            roadID,
            semester,
            classIndex,
            payload.override,
          ),
        roadID,
      );
    },

    /**
     * Low-level progress-assertion write, resolving the live road key.
     * `value === undefined` deletes the assertion. No history recording;
     * callers wrap apply + inverse in a single history.record pair.
     */
    setProgressAssertionRaw(
      roadID: string,
      uniqueKey: string,
      value: ProgressAssertion | undefined,
    ) {
      const road = this.roads[this.liveRoadKey(roadID)];
      if (road === undefined) {
        return;
      }
      if (value === undefined) {
        delete road.contents.progressAssertions[uniqueKey];
      } else {
        road.contents.progressAssertions[uniqueKey] = clone(value);
      }
      road.changed = formatFireroadDate();
      this.notifyRoadChange({
        fulfillment: "all",
        save: true,
        roadID: this.liveRoadKey(roadID),
      });
    },

    setPASubstitutions({
      uniqueKey,
      newReqs,
    }: {
      uniqueKey: string;
      newReqs: string[];
    }) {
      const roadID = this.activeRoad;
      const road = this.roads[roadID];
      if (road === undefined) {
        return;
      }
      const prior = road.contents.progressAssertions[uniqueKey];
      const priorSnapshot = prior === undefined ? undefined : clone(prior);
      const next: ProgressAssertion = { substitutions: newReqs };
      this.setProgressAssertionRaw(roadID, uniqueKey, next);
      history.record(
        "Substituted requirement",
        () => this.setProgressAssertionRaw(roadID, uniqueKey, priorSnapshot),
        () => this.setProgressAssertionRaw(roadID, uniqueKey, next),
        roadID,
      );
    },

    setPAIgnore({
      uniqueKey,
      isIgnored,
    }: {
      uniqueKey: string;
      isIgnored: boolean;
    }) {
      const roadID = this.activeRoad;
      const road = this.roads[roadID];
      if (road === undefined) {
        return;
      }
      const prior = road.contents.progressAssertions[uniqueKey];
      const priorSnapshot = prior === undefined ? undefined : clone(prior);
      let next: ProgressAssertion | undefined;
      if (isIgnored) {
        next = { ...prior, ignore: true };
      } else if (prior?.substitutions !== undefined) {
        // Unignore but keep an existing substitution.
        next = { substitutions: prior.substitutions };
      } else {
        // Unignore with nothing else to keep (or no assertion at all): drop
        // it. This also covers the crash case where `prior` is undefined.
        next = undefined;
      }
      this.setProgressAssertionRaw(roadID, uniqueKey, next);
      history.record(
        isIgnored ? "Ignored requirement" : "Restored requirement",
        () => this.setProgressAssertionRaw(roadID, uniqueKey, priorSnapshot),
        () => this.setProgressAssertionRaw(roadID, uniqueKey, next),
        roadID,
      );
    },

    removeProgressAssertion(uniqueKey: string) {
      const roadID = this.activeRoad;
      const road = this.roads[roadID];
      if (road === undefined) {
        return;
      }
      const prior = road.contents.progressAssertions[uniqueKey];
      if (prior === undefined) {
        return;
      }
      const priorSnapshot = clone(prior);
      this.setProgressAssertionRaw(roadID, uniqueKey, undefined);
      history.record(
        "Removed requirement override",
        () => this.setProgressAssertionRaw(roadID, uniqueKey, priorSnapshot),
        () => this.setProgressAssertionRaw(roadID, uniqueKey, undefined),
        roadID,
      );
    },

    setUnretrieved(roadIDs: string[]) {
      this.unretrieved = roadIDs;
    },

    setRetrieved(roadID: string) {
      const roadIDIndex = this.unretrieved.indexOf(roadID);
      if (roadIDIndex >= 0) {
        this.unretrieved.splice(roadIDIndex, 1);
      }
    },

    parseGenericCourses() {
      this.genericCourses = parseGenericCourses(this.subjectsInfo as Subject[]);
    },

    parseGenericIndex() {
      this.genericIndex = buildIndex(this.genericCourses as Subject[]);
    },

    parseSubjectsIndex() {
      this.subjectsIndex = buildIndex(this.subjectsInfo as Subject[]);
    },

    /** Jump to a crumb in the trail without discarding the rest of it. */
    setActiveClass(index: number) {
      if (index >= 0 && index < this.classInfoStack.length) {
        this.activeClassIndex = index;
      }
    },

    pushClassStack(id: string) {
      if (!(id in this.subjectsIndex) && !(id in this.genericIndex)) {
        return;
      }
      // navigating to the class you're already on is a no-op
      if (this.classInfoStack[this.activeClassIndex] === id) {
        return;
      }
      // Browser-history semantics: navigating onward from a crumb you stepped
      // back to drops the now-orphaned forward trail before appending, so the
      // trail stays one clean path instead of accumulating dead ends.
      this.classInfoStack.splice(this.activeClassIndex + 1);
      this.classInfoStack.push(id);
      this.activeClassIndex = this.classInfoStack.length - 1;
      // Hard-bound the trail so it can never grow without limit: the oldest
      // crumbs fall off the front. This keeps memory/DOM constant even under a
      // tight loop of navigations (it's client-only state, but an unbounded
      // structure tied to the DOM shouldn't exist regardless).
      const MAX_TRAIL = 6;
      if (this.classInfoStack.length > MAX_TRAIL) {
        const overflow = this.classInfoStack.length - MAX_TRAIL;
        this.classInfoStack.splice(0, overflow);
        this.activeClassIndex = Math.max(0, this.activeClassIndex - overflow);
      }
    },

    removeClass({
      classInfo,
      classIndex,
    }: {
      classInfo: SelectedSubject;
      classIndex: number;
    }) {
      const roadID = this.activeRoad;
      const semester = classInfo.semester;
      const snapshot = clone(classInfo);
      this.spliceClassRaw(roadID, semester, classIndex, 1);
      history.record(
        `Removed ${classInfo.subject_id} from ${bucketName(semester)}`,
        () =>
          this.spliceClassRaw(roadID, semester, classIndex, 0, clone(snapshot)),
        () => this.spliceClassRaw(roadID, semester, classIndex, 1),
        roadID,
      );
    },

    removeReq(event: string) {
      const roadID = this.activeRoad;
      const reqIndex =
        this.roads[roadID].contents.coursesOfStudy.indexOf(event);
      if (reqIndex === -1) {
        console.warn(
          "Attempted to remove a requirement not in the requirements list.",
        );
        return;
      }
      this.removeReqRaw(roadID, event);
      history.record(
        `Removed program ${event}`,
        () => this.addReqRaw(roadID, event),
        () => this.removeReqRaw(roadID, event),
        roadID,
      );
    },

    resetID({ oldid, newid }: { oldid: string; newid: string | number }) {
      newid = newid.toString();
      this.roads[newid] = this.roads[oldid];
      if (this.activeRoad === oldid) {
        this.activeRoad = newid;
      }
      delete this.roads[oldid];
      // Redirect history closures that captured the old key onto the new one
      // (see roadIdAlias). Without this, undo/redo of edits made before the
      // first server-save silently no-op while the undo stack still moves.
      roadIdAlias.set(oldid, newid);
      this.fulfillmentNeeded = "none";
      const migrationIndex = this.roadsToMigrate.indexOf(oldid);
      if (migrationIndex >= 0) {
        this.roadsToMigrate.splice(migrationIndex, 1, newid);
      }
      this.notifyRoadChange({ fulfillment: "none", save: false });
    },

    setActiveRoad(activeRoad: string) {
      this.activeRoad = activeRoad;
    },

    setLoggedIn(newLoggedIn: boolean) {
      this.loggedIn = newLoggedIn;
    },

    setHideIAP(value: boolean) {
      this.hideIAP = value;
      writeRawFlag(STORAGE_KEYS.hideIAP, value);
    },

    setRoadProp<K extends keyof Road>({
      id,
      prop,
      value,
      ignoreSet,
    }: {
      id: string;
      prop: K;
      value: Road[K];
      ignoreSet: boolean;
    }) {
      const road = this.roads[this.liveRoadKey(id)];
      if (road === undefined) {
        // The road was deleted (e.g. a placeholder removed) before an
        // in-flight save resolved and called back here; don't throw.
        return;
      }
      if (prop !== "contents") {
        this.fulfillmentNeeded = "none";
      }
      (road as unknown as Record<string, unknown>)[prop] = value;
      this.notifyRoadChange({
        fulfillment: prop !== "contents" ? "none" : "all",
        save: !ignoreSet,
      });
    },

    setRoad({
      id,
      road,
      ignoreSet,
    }: {
      id: string;
      road: Road;
      ignoreSet: boolean;
    }) {
      if (this.activeRoad !== id) {
        this.fulfillmentNeeded = "none";
      }
      this.roads[id] = road;
      this.notifyRoadChange({
        fulfillment: this.activeRoad !== id ? "none" : "all",
        save: !ignoreSet,
      });
    },

    setRoads(roads: Record<string, Road>) {
      this.roads = roads;
      this.notifyRoadChange({ fulfillment: "all", save: true });
    },

    setRoadName({ id, name }: { id: string; name: string }) {
      const previousName = this.roads[id].name;
      this.setRoadNameRaw(id, name);
      if (previousName !== name) {
        history.record(
          `Renamed road to “${name}”`,
          () => this.setRoadNameRaw(id, previousName),
          () => this.setRoadNameRaw(id, name),
          id,
        );
      }
    },

    setRoadNameRaw(id: string, name: string) {
      id = this.liveRoadKey(id);
      const road = this.roads[id];
      if (road === undefined) {
        return;
      }
      road.name = name;
      road.changed = formatFireroadDate();
      this.notifyRoadChange({ fulfillment: "none", save: true, roadID: id });
    },

    setSubjectsInfo(data: Subject[]) {
      this.subjectsInfo = data;
    },

    setCurrentSemester(sem: number) {
      this.currentSemester = Math.max(1, sem);
    },

    /**
     * Low-level manual-progress write, resolving the live road key.
     * `value === undefined` clears the override. No history recording.
     */
    setProgressOverrideRaw(
      roadID: string,
      listID: string,
      value: number | undefined,
    ) {
      const road = this.roads[this.liveRoadKey(roadID)];
      if (road === undefined) {
        return;
      }
      if (value === undefined) {
        delete road.contents.progressOverrides[listID];
      } else {
        road.contents.progressOverrides[listID] = value;
      }
      road.changed = formatFireroadDate();
      this.notifyRoadChange({
        fulfillment: "all",
        save: true,
        roadID: this.liveRoadKey(roadID),
      });
    },

    updateProgress(progress: { listID: string; progress: number }) {
      const roadID = this.activeRoad;
      const road = this.roads[roadID];
      if (road === undefined) {
        return;
      }
      const before = road.contents.progressOverrides[progress.listID];
      this.setProgressOverrideRaw(roadID, progress.listID, progress.progress);
      history.record(
        "Set manual progress",
        () => this.setProgressOverrideRaw(roadID, progress.listID, before),
        () =>
          this.setProgressOverrideRaw(
            roadID,
            progress.listID,
            progress.progress,
          ),
        roadID,
      );
    },

    setFromLocalStorage(localStore: Record<string, unknown>) {
      // The blob is untrusted (hand-editable, shared origin storage). The
      // sanitizer runs here, at the sink, so every caller is covered. The
      // cast is the runtime-validated boundary: the sanitizer rebuilds the
      // allowlisted fields onto fresh objects, which the static deep-partial
      // type of $patch cannot express.
      // eslint-disable-next-line no-restricted-syntax
      this.$patch(sanitizePersistedStore(localStore) as never);
    },

    queueRoadMigration(roadID: string) {
      this.roadsToMigrate.push(roadID);
    },

    clearMigrationQueue() {
      this.roadsToMigrate = [];
    },

    setThemeMode(mode: ThemeMode) {
      this.themeMode = mode;
    },

    setPanelSide(side: PanelSide) {
      this.panelSide = side;
    },

    /* ---- catalog loading ----
       The fetch itself (cache, retry, cross-reload persistence) is
       loaders/courseData.ts's useSubjectsLoader, a Pinia Colada query.
       This is left with just applying a fetched catalog to the rest of
       the store's state. */

    applyCatalog(subjects: Subject[]) {
      this.subjectsLoaded = true;
      this.setSubjectsInfo(subjects);
      this.parseGenericCourses();
      this.parseGenericIndex();
      this.parseSubjectsIndex();
      for (const roadID of this.roadsToMigrate) {
        this.migrateOldSubjects(roadID);
      }
      this.clearMigrationQueue();
    },

    waitAndMigrateOldSubjects(roadID: string) {
      if (this.subjectsLoaded) {
        this.migrateOldSubjects(roadID);
      } else {
        // App.vue's useSubjectsLoader() call already has the catalog in
        // flight by the time any road is retrieved; this just queues
        // the migration to drain in applyCatalog once it lands. Nothing
        // to migrate against if that load ends up failing, which is fine.
        this.queueRoadMigration(roadID);
      }
    },

    addAtPlaceholder(index: number) {
      if (this.itemAdding === undefined) {
        return;
      }
      let newClass: SelectedSubject;
      if (this.itemAdding.public === false) {
        // Adding custom class
        newClass = {
          overrideWarnings: false,
          semester: index,
          title: this.itemAdding.title,
          subject_id: this.itemAdding.subject_id,
          units: this.itemAdding.total_units,
          in_class_hours: this.itemAdding.in_class_hours,
          out_of_class_hours: this.itemAdding.out_of_class_hours,
          custom_color: this.itemAdding.custom_color,
          public: false,
        };
      } else {
        // Class is in catalog
        newClass = {
          overrideWarnings: false,
          semester: index,
          title: this.itemAdding.title,
          subject_id: this.itemAdding.subject_id,
          units: this.itemAdding.total_units,
        };
      }
      this.addClass(newClass);
      this.cancelAddFromCard();
    },
  },
});

// Undo/redo focus: before a history entry replays, switch the app to the
// road it edits, resolving the captured key through the alias table the
// same way the raw mutators do. Registered here rather than in history.ts
// because courseData imports history, so the hook is the only direction
// the dependency can run. The store is resolved at call time; undo/redo
// only ever run after Pinia is installed.
setHistoryRoadFocus((roadID) => {
  const store = useCourseDataStore();
  const live = store.liveRoadKey(roadID);
  if (live in store.roads && store.activeRoad !== live) {
    store.setActiveRoad(live);
  }
});
