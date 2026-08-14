// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { claimTabID, getAgent, randomTabID } from "../../../src/lib/agent";
import { STORAGE_KEYS, readValue } from "../../../src/lib/appStorage";

/**
 * The agent string is stored in synced roads and shown in FireRoad's
 * conflict dialog, so its shape is a frozen surface.
 */

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe("getAgent", () => {
  it("stamps platform, browser, and tab id in the frozen shape", () => {
    const agent = getAgent("3");
    expect(agent.endsWith(" Tab 3")).toBe(true);
    // jsdom reports its own platform/browser; the shape is what matters.
    expect(agent).toMatch(/^.* .* Tab 3$/);
  });
});

describe("randomTabID", () => {
  it("returns lowercase hex", () => {
    for (let i = 0; i < 20; i++) {
      expect(randomTabID()).toMatch(/^[0-9a-f]+$/);
    }
  });
});

describe("claimTabID", () => {
  it("claims id 1 in a fresh browser and registers it", () => {
    expect(claimTabID()).toBe("1");
    expect(sessionStorage.tabID).toBe("1");
    expect(readValue(STORAGE_KEYS.tabs)).toEqual({ ids: [1] });
  });

  it("allocates max+1 when other tabs exist", () => {
    claimTabID();
    sessionStorage.clear(); // a second tab: same origin storage, new session
    expect(claimTabID()).toBe("2");
    expect(readValue(STORAGE_KEYS.tabs)).toEqual({ ids: [1, 2] });
  });

  it("reuses this tab's existing id and re-registers it if dropped", () => {
    sessionStorage.tabID = "7";
    expect(claimTabID()).toBe("7");
    expect(readValue(STORAGE_KEYS.tabs)).toEqual({ ids: [7] });
    expect(claimTabID()).toBe("7");
    expect(readValue(STORAGE_KEYS.tabs)).toEqual({ ids: [7] });
  });

  it("still returns an id where sessionStorage access throws (F9)", () => {
    // Safari's block-all setting makes the sessionStorage global itself
    // throw on access. The claim must degrade to an unpersisted id, the
    // way appStorage treats unreadable localStorage as absent.
    vi.stubGlobal(
      "sessionStorage",
      new Proxy(
        {},
        {
          get() {
            throw new DOMException("blocked", "SecurityError");
          },
          set(): boolean {
            throw new DOMException("blocked", "SecurityError");
          },
        },
      ),
    );
    try {
      expect(claimTabID()).toBe("1");
      expect(readValue(STORAGE_KEYS.tabs)).toEqual({ ids: [1] });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
