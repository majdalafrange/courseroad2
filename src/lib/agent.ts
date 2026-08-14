/**
 * Per-tab agent identity for FireRoad conflict detection: each browser
 * tab gets a numeric id (sessionStorage plus a shared "tabs" entry in
 * origin-isolated storage), and saves are stamped
 * "<platform> <browser> Tab <id>". Ported from Auth.vue.
 */

import { UAParser } from "ua-parser-js";
import { STORAGE_KEYS, readValue, writeValue } from "./appStorage";

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
  return navigator.platform + " " + ua.browser.name + " Tab " + tabID;
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

/**
 * Claim this tab's id: reuse sessionStorage's, else allocate
 * max(existing)+1 in the shared list. Returns the tab id.
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
  const tabs = readTabs();
  if (tabs !== undefined && tabs.ids.length) {
    const maxTab = Math.max(...tabs.ids);
    const newTab = (maxTab + 1).toString();
    writeSessionTabID(newTab);
    tabs.ids.push(maxTab + 1);
    writeValue(STORAGE_KEYS.tabs, { ids: tabs.ids });
    return newTab;
  }
  writeSessionTabID("1");
  writeValue(STORAGE_KEYS.tabs, { ids: [1] });
  return "1";
}
