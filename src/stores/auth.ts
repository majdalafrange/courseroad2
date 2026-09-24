/**
 * Auth + cloud-sync store: MIT login via FireRoad OAuth, road
 * retrieval/saving with conflict detection, and local persistence when
 * logged out. Only genuine auth failures log out; transient network
 * errors keep local data and skip cloud sync.
 */

import { defineStore } from "pinia";
import { useRouter } from "vue-router";
import type { AccessInfo, ConflictInfo, Road, SaveWarning } from "../lib/types";
import { toast } from "../design/toast";
import { formatFireroadDate } from "../lib/dates";
import {
  ACCESS_INFO_TTL_MS,
  STORAGE_KEYS,
  clearAppStorage,
  hasRawValue,
  hasValue,
  readValue,
  removeValue,
  writeValue,
} from "../lib/appStorage";
import { getAgent, claimTabID, randomTabID } from "../lib/agent";
import {
  DEFAULT_ROAD_ID,
  emptySelectedSubjects,
  formatRoadContents,
  renumberName,
  sanitizeRoad,
} from "../lib/roads";
import { persistCurrentSemester, sanitizeRoadMap } from "../lib/persistedStore";
import type { RoadToSend } from "../lib/fireroad";
import { NoAuthError } from "../lib/fireroad";
import { fireroad, setFireroadToken } from "./fireroadClient";
import { useAuditStore } from "./audit";
import { useCourseDataStore } from "./courseData";
import { useFavoritesStore } from "./favorites";
import { useNotesStore } from "./notes";

const SAVE_DEBOUNCE_MS = 600;

/**
 * Road ids with a getRoad request in flight, keyed to its promise, so a
 * background prefetch and a manual switch to the same road share one fetch.
 */
const roadFetchesInFlight = new Map<
  string,
  Promise<Awaited<ReturnType<typeof fireroad.getRoad>> | undefined>
>();

/**
 * Whether an error means the login itself is gone (missing token, 401,
 * 403) rather than a transient failure. Only auth failures may wipe local
 * state: logoutUser() clears localStorage.
 */
function isAuthFailure(err: unknown): boolean {
  if (err instanceof NoAuthError) {
    return true;
  }
  const status = (err as { response?: { status?: number } }).response?.status;
  return status === 401 || status === 403;
}

export const useAuthStore = defineStore("auth", {
  state: () => ({
    accessInfo: undefined as AccessInfo | undefined,
    loggedIn: false,
    newRoads: [] as string[],
    saveWarnings: [] as SaveWarning[],
    gettingUserData: false,
    currentlySaving: false,
    tabID: randomTabID(),
    justLoaded: true,
    conflictInfo: undefined as ConflictInfo | undefined,
    conflictDialog: false,
    pendingSaves: {} as Record<string, ReturnType<typeof setTimeout>>,
  }),
  getters: {
    cookiesAllowed(): boolean | undefined {
      return useCourseDataStore().cookiesAllowed;
    },
  },
  actions: {
    setLoggedIn(newLoggedIn: boolean) {
      this.loggedIn = newLoggedIn;
      useCourseDataStore().setLoggedIn(newLoggedIn);
    },

    loginUser() {
      window.location.href = fireroad.loginUrl(import.meta.env.VITE_URL);
      if (this.cookiesAllowed) {
        writeValue(STORAGE_KEYS.hasLoggedIn, "true");
      }
    },

    logoutUser() {
      removeValue(STORAGE_KEYS.accessInfo);
      clearAppStorage();
      if (this.cookiesAllowed) {
        writeValue(STORAGE_KEYS.hasLoggedIn, "false");
      }
      this.loggedIn = false;
      this.accessInfo = undefined;
      setFireroadToken(undefined);
      window.location.reload();
    },

    setAccessInfo(accessInfo: AccessInfo | undefined) {
      this.accessInfo = accessInfo;
      setFireroadToken(accessInfo?.access_token);
    },

    async verify() {
      const currentMonth = new Date().getMonth();
      let verifyResponse;
      try {
        verifyResponse = await fireroad.verify();
      } catch (err) {
        if (isAuthFailure(err)) {
          this.logoutUser();
        }
        // Transient failure: reject without logging out, so this session
        // keeps its local data and simply skips cloud sync.
        return Promise.reject(err);
      }
      if (verifyResponse.data.success) {
        useCourseDataStore().setCurrentSemester(
          verifyResponse.data.current_semester - (currentMonth === 4 ? 1 : 0),
        );
        return verifyResponse.data;
      }
      // The server answered and refused the token.
      this.logoutUser();
      return Promise.reject(new Error("Token not valid"));
    },

    async retrieveRoad(roadID: string, options: { background?: boolean } = {}) {
      // Already in flight (e.g. a background prefetch): share its result.
      const existing = roadFetchesInFlight.get(roadID);
      if (existing !== undefined) {
        return existing;
      }
      const store = useCourseDataStore();
      // Background prefetches skip gettingUserData, which drives the
      // header's "Loading..." state.
      if (options.background !== true) {
        this.gettingUserData = true;
      }
      const fetchPromise = (async () => {
        try {
          const roadData = await fireroad.getRoad(roadID);
          if (!(
            roadData.status === 200 &&
            roadData.data.success &&
            roadData.data.file
          )) {
            // Server error, deleted road, or malformed payload: leave it
            // in `unretrieved` so the next switch retries.
            return roadData;
          }
          roadData.data.file.downloaded = formatFireroadDate();
          roadData.data.file.changed = formatFireroadDate();
          sanitizeRoad(roadData.data.file);
          store.setRoad({
            id: roadID,
            road: roadData.data.file,
            ignoreSet: true,
          });
          store.setRetrieved(roadID);
          store.waitAndMigrateOldSubjects(roadID);
          return roadData;
        } catch (err) {
          // Dropped request: leave the road in `unretrieved` so the next
          // switch retries.
          console.error(`Road retrieval failed for ${roadID}:`, err);
          return undefined;
        }
      })();
      roadFetchesInFlight.set(roadID, fetchPromise);
      try {
        return await fetchPromise;
      } finally {
        roadFetchesInFlight.delete(roadID);
        if (options.background !== true) {
          this.gettingUserData = false;
        }
      }
    },

    async getUserData(routeRoadID?: string) {
      const store = useCourseDataStore();
      this.gettingUserData = true;
      void useNotesStore().loadFromCloud();
      void useFavoritesStore().loadFromCloud();
      try {
        const response = await fireroad.getRoads();
        if (!(response.status === 200 && response.data.success)) {
          throw new Error("sync request not successful in getUserData");
        }
        const files = response.data.files;
        this.renumberRoads(files);
        for (let i = 0; i < this.newRoads.length; i++) {
          this.saveRemote(this.newRoads[i]);
        }
        const fileKeys = Object.keys(files);
        for (let i = 0; i < fileKeys.length; i++) {
          const blankRoad: Road = {
            downloaded: formatFireroadDate(),
            changed: files[fileKeys[i]].changed,
            name: files[fileKeys[i]].name,
            agent: files[fileKeys[i]].agent,
            contents: {
              coursesOfStudy: ["girs"],
              selectedSubjects: emptySelectedSubjects(),
              progressOverrides: {},
              progressAssertions: {},
            },
          };
          store.setRoad({ id: fileKeys[i], road: blankRoad, ignoreSet: true });
        }
        // Remove the pre-login placeholder only if it is still the untouched
        // default. Keyed on content, not `justLoaded`, which a mutation
        // earlier in this sync already flipped. A default road carrying real
        // work is migrated to a server id by the saveRemote loop above;
        // deleting it here would race that save.
        const defaultRoad = store.roads[DEFAULT_ROAD_ID];
        const defaultIsPristine =
          defaultRoad !== undefined &&
          defaultRoad.contents.selectedSubjects.flat().length === 0 &&
          JSON.stringify(Array.from(defaultRoad.contents.coursesOfStudy)) ===
            '["girs"]';
        if (fileKeys.length > 0 && defaultIsPristine) {
          store.deleteRoad(DEFAULT_ROAD_ID);
        }
        if (routeRoadID !== undefined && fileKeys.includes(routeRoadID)) {
          store.setActiveRoad(routeRoadID);
        } else {
          store.setActiveRoad(Object.keys(store.roads)[0]);
        }
        store.setUnretrieved(fileKeys);
        if (fileKeys.length) {
          if (routeRoadID !== undefined && fileKeys.includes(routeRoadID)) {
            await this.retrieveRoad(routeRoadID);
          } else {
            await this.retrieveRoad(fileKeys[0]);
          }
        }
        this.gettingUserData = false;
        // Warm the rest of the user's roads in the background, one at a
        // time, so switching to them later finds the data already there.
        void (async () => {
          for (const id of fileKeys) {
            if (store.unretrieved.includes(id)) {
              await this.retrieveRoad(id, { background: true });
            }
          }
        })();
      } catch (err) {
        this.gettingUserData = false;
        if (
          isAuthFailure(err) ||
          (err as Error).message === "Token not valid"
        ) {
          alert("Your login has expired. Log in again to sync.");
          this.logoutUser();
        } else {
          // Network or server failure: local data stays; sync resumes on
          // the next edit or reload.
          console.error("Road sync failed:", err);
        }
      }
    },

    renumberRoads(cloudFiles: Record<string, { name: string }>) {
      const store = useCourseDataStore();
      const cloudRoads = Object.keys(cloudFiles).map((id) => cloudFiles[id]);
      const cloudNames = cloudRoads.map((cr) => cr?.name);
      for (const roadID in store.roads) {
        if (roadID in cloudFiles) {
          // A road stored under a cloud id is that cloud road; matching it
          // against its own server name would renumber every road on boot.
          continue;
        }
        const localName = store.roads[roadID].name;
        if (cloudNames.indexOf(localName) >= 0) {
          const renumberedName = renumberName(
            localName,
            cloudNames as string[],
          );
          // Raw rename: a background sync operation, not a user edit, so it
          // must not land on the undo stack.
          store.setRoadNameRaw(roadID, renumberedName);
        }
      }
    },

    async getAuthorizationToken(code: string) {
      const response = await fireroad.fetchToken(code);
      if (response.data.success) {
        if (this.cookiesAllowed) {
          writeValue(
            STORAGE_KEYS.accessInfo,
            response.data.access_info,
            ACCESS_INFO_TTL_MS,
          );
        }
        this.setAccessInfo(response.data.access_info);
        this.verify().catch((err) => {
          console.warn("Post-login verification failed:", err);
        });
        this.setLoggedIn(true);
        void this.getUserData();
      }
    },

    attemptLogin(routeRoadID?: string) {
      const queryObject = new URLSearchParams(window.location.search);
      const code = queryObject.get("code");
      if (code !== null) {
        queryObject.delete("code");
        void useRouter().replace({
          name: "/road/[[road]]",
          params: { road: useCourseDataStore().activeRoad },
          query: Object.fromEntries(queryObject),
        });
        this.getAuthorizationToken(code).catch((err: unknown) => {
          console.error("Login failed:", err);
          toast.danger("Couldn't log you in. Try again.");
        });
      } else if (
        readValue<string>(STORAGE_KEYS.hasLoggedIn) === "true" &&
        !this.loggedIn
      ) {
        this.loginUser();
      }
      void routeRoadID;
    },

    /** Debounced save entry point. */
    queueSave(roadID: string) {
      if (this.pendingSaves[roadID] !== undefined) {
        clearTimeout(this.pendingSaves[roadID]);
      }
      this.currentlySaving = true;
      this.pendingSaves[roadID] = setTimeout(() => {
        delete this.pendingSaves[roadID];
        this.save(roadID);
      }, SAVE_DEBOUNCE_MS);
    },

    save(roadID: string) {
      if (this.loggedIn) {
        this.saveRemote(roadID);
      } else {
        this.saveLocal();
      }
    },

    /**
     * Run pending debounced saves now (tab close), since the timers die
     * with the page. Local saves are synchronous and safe at unload; remote
     * saves keep their debounce, as a network call at unload is cut off
     * anyway.
     */
    flushPendingSaves() {
      if (this.loggedIn) {
        return;
      }
      const pending = Object.keys(this.pendingSaves);
      if (pending.length === 0) {
        return;
      }
      for (const roadID of pending) {
        clearTimeout(this.pendingSaves[roadID]);
        delete this.pendingSaves[roadID];
      }
      this.saveLocal();
    },

    saveRemote(roadID: string, override = false) {
      const store = useCourseDataStore();
      if (!(roadID in store.roads)) {
        // The road was deleted or renamed away before this debounced save
        // fired; reset the flag queueSave set, or "Saving..." sticks.
        this.currentlySaving = false;
        return;
      }
      this.currentlySaving = true;
      this.saveWarnings = [];
      const assignKeys: { override: boolean; agent: string; id?: string } = {
        override,
        agent: getAgent(this.tabID),
      };
      if (!roadID.includes("$")) {
        assignKeys.id = roadID;
      }
      const roadToSend = {} as RoadToSend;
      Object.assign(
        roadToSend,
        store.roads[roadID],
        { contents: formatRoadContents(store.roads[roadID].contents) },
        assignKeys,
      );
      const savePromise = fireroad.syncRoad(roadToSend).then((response) => {
        const oldid = roadID;
        if (response.status !== 200) {
          return Promise.reject(new Error("Unable to save road " + oldid));
        }
        const newid = response.data.id !== undefined ? response.data.id : oldid;
        if (response.data.success === false) {
          this.saveWarnings.push({
            id: String(newid),
            error: response.data.error_msg ?? "Unknown error",
            name: store.roads[oldid].name,
          });
        }
        if (response.data.result === "conflict") {
          const conflictInfo: ConflictInfo = {
            id: oldid,
            other_name: response.data.other_name!,
            other_agent: response.data.other_agent!,
            other_date: response.data.other_date!,
            other_contents: response.data.other_contents!,
            this_agent: response.data.this_agent,
            this_date: response.data.this_date,
          };
          store.setRoadProp({
            id: oldid,
            prop: "agent",
            value: getAgent(this.tabID),
            ignoreSet: true,
          });
          this.startConflict(conflictInfo);
          return Promise.resolve({ oldid, state: "same" });
        } else if (response.data.result === "update_local") {
          toast.warn(
            "Loaded newer edits from the cloud",
            "This road was changed elsewhere, so the copy in this tab was replaced. If that is unexpected, check that your computer clock is accurate.",
          );
          const updatedRoad = {
            downloaded: formatFireroadDate(),
            changed: response.data.changed!,
            name: response.data.name!,
            agent: getAgent(this.tabID),
            contents: response.data.contents!,
          } as unknown as Road;
          sanitizeRoad(updatedRoad);
          store.setRoad({ id: oldid, road: updatedRoad, ignoreSet: false });
          return Promise.resolve({
            oldid,
            newid: String(response.data.id),
            state: "same",
          });
        } else {
          store.setRoadProp({
            id: oldid,
            prop: "downloaded",
            value: formatFireroadDate(),
            ignoreSet: true,
          });
          if (response.data.id !== undefined) {
            if (oldid !== response.data.id.toString()) {
              store.resetID({ oldid, newid: response.data.id });
            }
            return Promise.resolve({
              oldid,
              newid: String(response.data.id),
              state: "changed",
            });
          }
          return Promise.resolve({ oldid, newid: oldid, state: "same" });
        }
      });
      savePromise
        .then((saveResult) => {
          if (saveResult.state === "changed") {
            const oldIdIndex = this.newRoads.indexOf(saveResult.oldid);
            if (oldIdIndex >= 0) {
              this.newRoads.splice(oldIdIndex, 1);
            }
          }
          if (hasValue(STORAGE_KEYS.newRoads)) {
            writeValue(STORAGE_KEYS.newRoads, this.getNewRoadData());
          }
          this.currentlySaving = false;
        })
        .catch((err) => {
          if (!(err instanceof NoAuthError)) {
            console.error(err);
          }
          this.currentlySaving = false;
        });
    },

    saveLocal() {
      const store = useCourseDataStore();
      this.currentlySaving = true;
      if (this.cookiesAllowed) {
        writeValue(STORAGE_KEYS.newRoads, this.getNewRoadData());
      }
      for (const roadID in store.roads) {
        store.setRoadProp({
          id: roadID,
          prop: "downloaded",
          value: formatFireroadDate(),
          ignoreSet: true,
        });
      }
      this.currentlySaving = false;
    },

    getNewRoadData(): Record<string, Road> {
      const store = useCourseDataStore();
      // Derived from the roads that exist, not the newRoads list: a replayed
      // redo can put a road back without re-registering it. The untouched
      // default road stays unpersisted, matching the restore path.
      const newRoadData: Record<string, Road> = {};
      for (const roadID of Object.keys(store.roads)) {
        if (!roadID.includes("$")) {
          // Server-backed road; the cloud copy is authoritative.
          continue;
        }
        if (roadID === DEFAULT_ROAD_ID) {
          const defaultContents = store.roads[DEFAULT_ROAD_ID].contents;
          const pristine =
            defaultContents.selectedSubjects.flat().length === 0 &&
            JSON.stringify(Array.from(defaultContents.coursesOfStudy)) ===
              '["girs"]';
          if (pristine) {
            continue;
          }
        }
        if (this.newRoads.indexOf(roadID) === -1) {
          this.newRoads.push(roadID);
        }
        newRoadData[roadID] = store.roads[roadID];
      }
      return newRoadData;
    },

    startConflict(conflictInfo: ConflictInfo) {
      this.conflictInfo = conflictInfo;
      this.conflictDialog = true;
    },

    resolveConflict() {
      this.conflictDialog = false;
      this.conflictInfo = undefined;
    },

    /** Conflict: keep local version (force-save over the cloud). */
    updateRemote(roadID: string) {
      this.saveRemote(roadID, true);
      this.resolveConflict();
    },

    /** Conflict: keep the cloud version. */
    updateLocal(roadID: string) {
      if (this.conflictInfo === undefined) {
        return;
      }
      const remoteRoad = {
        name: this.conflictInfo.other_name,
        agent: this.conflictInfo.other_agent,
        changed: this.conflictInfo.other_date,
        contents: this.conflictInfo.other_contents,
        downloaded: formatFireroadDate(),
      } as unknown as Road;
      sanitizeRoad(remoteRoad);
      useCourseDataStore().setRoad({
        id: roadID,
        road: remoteRoad,
        ignoreSet: false,
      });
      this.resolveConflict();
    },

    deleteRoad(roadID: string) {
      const store = useCourseDataStore();
      if (store.activeRoad === roadID) {
        const roadIndex = Object.keys(store.roads).indexOf(roadID);
        const withoutRoad = Object.keys(store.roads)
          .slice(0, roadIndex)
          .concat(Object.keys(store.roads).slice(roadIndex + 1));
        if (withoutRoad.length) {
          if (withoutRoad.length > roadIndex) {
            store.setActiveRoad(withoutRoad[roadIndex]);
          } else {
            store.setActiveRoad(withoutRoad[roadIndex - 1]);
          }
        } else {
          store.setActiveRoad("");
        }
      }
      store.deleteRoad(roadID);
      const newRoadIndex = this.newRoads.indexOf(roadID);
      if (newRoadIndex >= 0) {
        this.newRoads.splice(newRoadIndex, 1);
      }
      if (this.loggedIn) {
        if (roadID.indexOf("$") < 0) {
          // The road is already gone locally (optimistic delete with undo);
          // a failed server delete only means it may reappear on the next
          // sync.
          fireroad.deleteRoad(roadID).catch((err: unknown) => {
            console.warn(`Server delete failed for road ${roadID}:`, err);
          });
        }
      } else {
        // Logged out there is no server call, and courseData.deleteRoad
        // notifies with save:false, so persist here.
        this.saveLocal();
      }
    },

    setTabID() {
      if (this.cookiesAllowed) {
        this.tabID = claimTabID();
      }
    },

    changeSemester(year: number) {
      const store = useCourseDataStore();
      const currentMonth = new Date().getMonth();
      const sem =
        currentMonth >= 5 && currentMonth <= 10 ? 1 + year * 3 : 3 + year * 3;
      fireroad
        .setSemester(sem + (currentMonth === 4 ? 1 : 0))
        .then((res) => {
          if (res.status === 200 && res.data.success) {
            store.setCurrentSemester(sem);
            persistCurrentSemester(sem);
          }
        })
        .catch((err) => {
          if ((err as Error).message === "No auth information") {
            // Logged out: the local copy is the only one.
            store.setCurrentSemester(sem);
            persistCurrentSemester(sem);
          } else {
            // Logged in but the request failed (offline, a 500).
            console.error("Semester change failed:", err);
            toast.danger(
              "Couldn't change your semester",
              "Check your connection and try again.",
            );
          }
        });
    },

    /**
     * Restore locally persisted state on startup (newRoads + accessInfo).
     * The road map is validated: the blob is hand-editable and may come
     * from older versions.
     */
    restoreFromStorage(routeRoadID?: string) {
      const store = useCourseDataStore();
      if (hasValue(STORAGE_KEYS.newRoads)) {
        const stored = readValue<Record<string, unknown>>(
          STORAGE_KEYS.newRoads,
        );
        const newRoads = sanitizeRoadMap(stored);
        const restoredCount =
          newRoads === undefined ? 0 : Object.keys(newRoads).length;
        if (newRoads !== undefined && restoredCount > 0) {
          if (this.justLoaded) {
            if (!(store.activeRoad in newRoads)) {
              store.setActiveRoad(Object.keys(newRoads)[0]);
            }
            store.roads = newRoads;
          } else {
            store.roads = Object.assign(newRoads, store.roads);
          }
          this.newRoads = Object.keys(newRoads);
          // The roads are hydrated now; replay any audit recompute that
          // arrived while the store still held only the empty default.
          useAuditStore().flushPendingFulfillment();
        }
        // A stored road the sanitizer dropped is lost user data; say so.
        const storedCount =
          typeof stored === "object" && stored !== null
            ? Object.keys(stored).length
            : 0;
        if (restoredCount < storedCount) {
          const dropped = storedCount - restoredCount;
          toast.warn(
            dropped === 1
              ? "A saved road couldn't be read"
              : `We couldn't read ${dropped} saved roads`,
            restoredCount > 0
              ? "The others loaded."
              : "Starting with an empty road.",
          );
        }
        // Restores the in-memory flag: this entry can only exist because
        // consent was granted in a prior session.
        store.allowCookies();
      } else if (hasRawValue(STORAGE_KEYS.newRoads)) {
        // Bytes exist but the entry is unreadable (truncated storage or a
        // hand edit).
        toast.warn(
          "Saved roads couldn't be read",
          "The stored copy was unreadable. Starting with an empty road.",
        );
      }

      const accessInfo = readValue<AccessInfo>(STORAGE_KEYS.accessInfo);
      if (accessInfo !== undefined && typeof accessInfo === "object") {
        this.setAccessInfo(accessInfo);
        this.setLoggedIn(true);
        // Same as above: prior-session consent, not a new grant.
        store.allowCookies();
        this.verify()
          .then(() => this.getUserData(routeRoadID))
          .catch((err) => {
            // Offline or FireRoad down: stay logged in locally and skip
            // cloud sync. Auth failures already logged out inside verify.
            console.warn("Login verification failed; skipping sync:", err);
          });
      }

      this.setTabID();
    },
  },
});
