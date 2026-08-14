/**
 * Auth + cloud-sync store: MIT login via FireRoad OAuth, road
 * retrieval/saving with conflict detection, logged-out cookie-persistence.
 * Extracted from legacy Auth.vue; payload formats and cookie keys
 * unchanged. Departures: cookie-restored roads are now validated
 * (lib/persistedStore.ts), and only genuine auth failures log out;
 * transient network errors keep local data and skip cloud sync instead.
 */

import { defineStore } from "pinia";
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

const SAVE_DEBOUNCE_MS = 600;

/**
 * Whether an error is evidence the login itself is gone (missing token,
 * or the server refusing it) rather than a transient network/server
 * failure. Only auth failures may wipe local state: logoutUser() clears
 * localStorage, so treating an offline moment as a bad token would cost
 * the user their local roads.
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

    async retrieveRoad(roadID: string) {
      const store = useCourseDataStore();
      this.gettingUserData = true;
      const roadData = await fireroad.getRoad(roadID);
      if (!(
        roadData.status === 200 &&
        roadData.data.success &&
        roadData.data.file
      )) {
        // Server error, deleted road, or malformed payload: skip gracefully
        // instead of dereferencing an absent `file`. Dereferencing it here
        // throws, and the caller's catch runs logoutUser() →
        // localStorage.clear() + reload; a corrupt cloud road would wipe
        // the user's local data and loop them out of login.
        this.gettingUserData = false;
        return roadData;
      }
      roadData.data.file.downloaded = formatFireroadDate();
      roadData.data.file.changed = formatFireroadDate();
      sanitizeRoad(roadData.data.file);
      store.setRoad({ id: roadID, road: roadData.data.file, ignoreSet: true });
      store.setRetrieved(roadID);
      store.waitAndMigrateOldSubjects(roadID);
      this.gettingUserData = false;
      return roadData;
    },

    async getUserData(routeRoadID?: string) {
      const store = useCourseDataStore();
      this.gettingUserData = true;
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
        // Remove the anonymous pre-login placeholder, but ONLY if it is still
        // the untouched default (no classes, default programs). Keyed on
        // pristine CONTENT, not on `justLoaded` (which a store mutation
        // earlier in this sync flips false via the onRoadChange subscriber
        // before this runs; the bug that stranded $defaultroad$). A default
        // road carrying real pre-login work is left alone: the saveRemote
        // loop above migrates it to a server id (via resetID). Deleting it
        // here would race that in-flight save, losing the work and crashing
        // the save's resolve handler on a now-missing road.
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
        const localName = store.roads[roadID].name;
        if (cloudNames.indexOf(localName) >= 0) {
          const renumberedName = renumberName(
            localName,
            cloudNames as string[],
          );
          // Raw (non-recording) rename: this is a background sync operation,
          // not a user edit: it must persist the name but must NOT push a
          // "Renamed road" entry onto the user's undo stack.
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
        this.getUserData();
      }
    },

    attemptLogin(routeRoadID?: string) {
      const queryObject = new URLSearchParams(window.location.search);
      const code = queryObject.get("code");
      if (code !== null) {
        window.history.pushState(
          "CourseRoad Home",
          "CourseRoad Home",
          "./#" + useCourseDataStore().activeRoad,
        );
        this.getAuthorizationToken(code);
      } else if (
        readValue<string>(STORAGE_KEYS.hasLoggedIn) === "true" &&
        !this.loggedIn
      ) {
        this.loginUser();
      }
      void routeRoadID;
    },

    /** Debounced save entry point (replaces the deep-watcher autosave). */
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
     * Run pending debounced saves now (tab close): the timers die with
     * the page, so an edit inside the debounce window was lost. Local
     * saves are synchronous localStorage writes and safe at unload.
     * Remote saves keep their debounce: a network call at unload is cut
     * off anyway, and interrupting it here would also skip the local
     * fallback the debounced path never had.
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
        // The road was deleted/renamed away before this debounced save
        // fired. Reset the flag we optimistically set in queueSave, or the
        // header's "Saving…" indicator sticks on forever.
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
          alert(
            "Server has more recent edits.  Overriding local road.  If this is unexpected, check that your computer clock is accurate.",
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
      // Derived from the roads that actually exist, not from the newRoads
      // bookkeeping list: a replayed redo can put a road back in the store
      // without re-registering it, and any such drift used to mean the
      // persisted map described fewer roads than the switcher showed, so a
      // reload lost them. The untouched default road stays unpersisted,
      // matching the restore path, which ignores an empty map.
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
          fireroad.deleteRoad(roadID);
        }
      } else {
        // The server delete above is the logged-in path's persistence.
        // Logged out there is no separate call, and courseData.deleteRoad
        // notifies with save:false, so without this write the stored map
        // keeps the road and a reload brings it back.
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
            // Logged out: the server holds nothing, so the local copy is
            // the only one. It persists like hideIAP and the theme do.
            store.setCurrentSemester(sem);
            persistCurrentSemester(sem);
          }
        });
    },

    /**
     * Restore locally-persisted state on startup (newRoads + accessInfo).
     * Both come from origin-isolated storage, so no other host can plant
     * them; the road map is still validated, since the blob is editable by
     * hand and carries data from older versions.
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
        // A stored road the sanitizer had to drop is user data lost on
        // this path; say so instead of passing it off as a fresh start.
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
              ? "The rest came back fine."
              : "Your plan starts fresh from here.",
          );
        }
        // Restores the in-memory flag: this entry can only exist because
        // consent was granted in a prior session.
        store.allowCookies();
      } else if (hasRawValue(STORAGE_KEYS.newRoads)) {
        // Bytes exist but the entry is unreadable (truncated storage or a
        // hand edit). Recovering to a fresh road is right; doing it in
        // silence is not.
        toast.warn(
          "Saved roads couldn't be read",
          "The stored copy was unreadable, so we're starting your plan fresh.",
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
            // cloud sync for this session. (Auth failures already logged
            // out and reloaded inside verify.)
            console.warn("Login verification failed; skipping sync:", err);
          });
      }

      this.setTabID();
    },
  },
});
