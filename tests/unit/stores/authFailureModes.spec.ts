import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// Mock the FireRoad client singleton before the auth store imports it.
const mocks = vi.hoisted(() => ({
  getRoads: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("../../../src/stores/fireroadClient", () => ({
  setFireroadToken: vi.fn(),
  fireroad: {
    getRoads: mocks.getRoads,
    verify: mocks.verify,
  },
}));

import {
  STORAGE_KEYS,
  readValue,
  writeValue,
} from "../../../src/lib/appStorage";
import { useAuthStore } from "../../../src/stores/auth";

describe("auth failure modes: local data survives transient errors", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.getRoads.mockReset();
    mocks.verify.mockReset();
    localStorage.clear();
    // An app-owned key (cleared on logout) and a foreign key on the same
    // origin (must survive: logout clears this app's data, not the origin).
    writeValue(STORAGE_KEYS.accessInfo, { access_token: "t" });
    localStorage.setItem("unrelated", "keep me");
    vi.spyOn(window, "alert").mockImplementation(() => {});
    // logoutUser calls window.location.reload(); jsdom's is a logged
    // "not implemented" no-op, which is exactly what the test needs.
  });

  it("getUserData keeps login and localStorage on a network error", async () => {
    const auth = useAuthStore();
    auth.loggedIn = true;
    mocks.getRoads.mockRejectedValue(new Error("Network Error"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await auth.getUserData();

    expect(auth.loggedIn).toBe(true);
    expect(readValue(STORAGE_KEYS.accessInfo)).toBeDefined();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("getUserData logs out on a 401", async () => {
    const auth = useAuthStore();
    auth.loggedIn = true;
    mocks.getRoads.mockRejectedValue({ response: { status: 401 } });

    await auth.getUserData();

    expect(auth.loggedIn).toBe(false);
    expect(readValue(STORAGE_KEYS.accessInfo)).toBeUndefined();
    // Logout clears this app's keys only, not the whole origin.
    expect(localStorage.getItem("unrelated")).toBe("keep me");
    expect(window.alert).toHaveBeenCalledOnce();
  });

  it("verify rejects without logging out on a network error", async () => {
    const auth = useAuthStore();
    auth.loggedIn = true;
    mocks.verify.mockRejectedValue(new Error("Network Error"));

    await expect(auth.verify()).rejects.toThrow("Network Error");

    expect(auth.loggedIn).toBe(true);
    expect(readValue(STORAGE_KEYS.accessInfo)).toBeDefined();
  });

  it("verify logs out when the server refuses the token", async () => {
    const auth = useAuthStore();
    auth.loggedIn = true;
    mocks.verify.mockResolvedValue({ status: 200, data: { success: false } });

    await expect(auth.verify()).rejects.toThrow("Token not valid");

    expect(auth.loggedIn).toBe(false);
    expect(readValue(STORAGE_KEYS.accessInfo)).toBeUndefined();
  });
});
