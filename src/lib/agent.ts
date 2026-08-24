/**
 * Per-tab agent identity for FireRoad conflict detection: each browser
 * tab gets a numeric id (sessionStorage plus a shared "tabs" entry in
 * origin-isolated storage), and saves are stamped
 * "<platform> <browser> Tab <id>". Ported from Auth.vue.
 */

import { UAParser } from "ua-parser-js";
import { STORAGE_KEYS, readValue, removeValue, writeValue } from "./appStorage";

interface TabIds {
  ids: number[];
}

function readTabs(): TabIds | undefined {
  const tabs = readValue<TabIds>(STORAGE_KEYS.tabs);
  return tabs !== undefined && Array.isArray(tabs.ids) ? tabs : undefined;
}

/** Agent string sent with every road save. */
export function getAgent(tabID: string): string {
  const ua = UAParser(navigator.userAgent);
  return (ua.os.name ?? "") + " " + ua.browser.name + " Tab " + tabID;
}

/** Random fallback tab id (used before cookies are allowed). */
export function randomTabID(): string {
  return Math.floor(Math.random() * 16 ** 10).toString(16);
}

/**
 * The sessionStorage global itself throws where storage is blocked
 * entirely (Safari's block-all setting), the same failure appStorage
 * guards for localStorage. An unreadable id means this tab holds none;
 * an unwritable one lives for this page view only.
 */
function readSessionTabID(): string | undefined {
  try {
    return sessionStorage.tabID as string | undefined;
  } catch {
    return undefined;
  }
}

function writeSessionTabID(id: string): void {
  try {
    sessionStorage.tabID = id;
  } catch {
    // Storage unavailable; the id is not kept across reloads.
  }
}

interface TabClaim {
  n: number;
  token: string;
}

/**
 * Allocate max(existing)+1, retrying if a concurrently-opening tab reads
 * the same base list and claims the same number first. The claim-token
 * write-then-read-back emulates compare-and-swap: whoever's token is
 * still on file after both writes won the number.
 */
function allocateTabID(): string {
  for (let attempt = 0; attempt < 5; attempt++) {
    const tabs = readTabs();
    const newTab =
      tabs !== undefined && tabs.ids.length ? Math.max(...tabs.ids) + 1 : 1;
    const nextIds = tabs !== undefined ? [...tabs.ids, newTab] : [newTab];
    writeValue(STORAGE_KEYS.tabs, { ids: nextIds });
    const token = Math.random().toString(36).slice(2);
    writeValue(STORAGE_KEYS.tabClaim, { n: newTab, token });
    const claim = readValue<TabClaim>(STORAGE_KEYS.tabClaim);
    if (claim?.n === newTab && claim.token === token) {
      return newTab.toString();
    }
    // Lost the race for newTab; retry against the winner's list.
  }
  // Retries exhausted; fall back rather than risk a silent duplicate.
  return randomTabID();
}

/**
 * Claim this tab's id: reuse sessionStorage's, else allocate a fresh one.
 * Returns the tab id.
 */
export function claimTabID(): string {
  const existing = readSessionTabID();
  if (existing !== undefined) {
    const tabNum = parseInt(existing);
    const tabs = readTabs();
    if (tabs !== undefined) {
      if (tabs.ids.indexOf(tabNum) === -1) {
        tabs.ids.push(tabNum);
        writeValue(STORAGE_KEYS.tabs, { ids: tabs.ids });
      }
    } else {
      writeValue(STORAGE_KEYS.tabs, { ids: [tabNum] });
    }
    return existing;
  }
  const newTab = allocateTabID();
  writeSessionTabID(newTab);
  return newTab;
}

/** Release this tab's id from the shared list on unload. */
export function releaseTabID(): void {
  const existing = readSessionTabID();
  if (existing === undefined) {
    return;
  }
  const tabs = readTabs();
  if (tabs === undefined) {
    return;
  }
  const tabIndex = tabs.ids.indexOf(parseInt(existing));
  if (tabIndex === -1) {
    return;
  }
  tabs.ids.splice(tabIndex, 1);
  if (tabs.ids.length) {
    writeValue(STORAGE_KEYS.tabs, { ids: tabs.ids });
  } else {
    removeValue(STORAGE_KEYS.tabs);
  }
}
