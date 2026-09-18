import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// Mock the FireRoad client singleton before the auth store imports it.
const mocks = vi.hoisted(() => ({
  fetchToken: vi.fn(),
  verify: vi.fn(),
  getRoads: vi.fn(),
  setFireroadToken: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("../../../src/stores/fireroadClient", () => ({
  setFireroadToken: mocks.setFireroadToken,
  fireroad: {
    fetchToken: mocks.fetchToken,
    verify: mocks.verify,
    getRoads: mocks.getRoads,
  },
}));

// attemptLogin calls useRouter() inside the action.
vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  return { ...actual, useRouter: () => ({ replace: mocks.replace }) };
});

import { toast } from "../../../src/design/toast";
import { STORAGE_KEYS, readValue } from "../../../src/lib/appStorage";
import { useAuthStore } from "../../../src/stores/auth";
import { useCourseDataStore } from "../../../src/stores/courseData";

// FireRoad sends the browser back to VITE_URL with ?code=...
describe("auth.attemptLogin (OAuth callback)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    mocks.fetchToken.mockReset();
    mocks.verify.mockReset();
    mocks.getRoads.mockReset();
    mocks.setFireroadToken.mockReset();
    mocks.replace.mockReset();
    while (toast.state.toasts.length > 0) {
      toast.dismiss(toast.state.toasts[0].id);
    }
    window.history.replaceState({}, "", "/");
  });

  it("redeems ?code= and strips it from the route, keeping other query keys", async () => {
    window.history.replaceState({}, "", "/?code=abc123&demo=1");
    mocks.fetchToken.mockResolvedValue({
      data: { success: true, access_info: { access_token: "tok" } },
    });
    mocks.verify.mockResolvedValue({
      data: { success: true, current_semester: 4 },
    });
    mocks.getRoads.mockResolvedValue({
      status: 200,
      data: { success: true, files: {} },
    });
    const store = useCourseDataStore();
    store.allowCookies();
    const auth = useAuthStore();

    auth.attemptLogin();

    expect(mocks.fetchToken).toHaveBeenCalledWith("abc123");
    expect(mocks.replace).toHaveBeenCalledOnce();
    const target = mocks.replace.mock.calls[0][0];
    expect(target.name).toBe("/road/[[road]]");
    expect(target.query).toEqual({ demo: "1" });

    await vi.waitFor(() => expect(auth.loggedIn).toBe(true));
    expect(mocks.setFireroadToken).toHaveBeenCalledWith("tok");
    expect(readValue(STORAGE_KEYS.accessInfo)).toEqual({
      access_token: "tok",
    });
    await vi.waitFor(() => expect(mocks.getRoads).toHaveBeenCalledOnce());
  });

  it("does not persist the token when storage consent was declined", async () => {
    window.history.replaceState({}, "", "/?code=abc123");
    mocks.fetchToken.mockResolvedValue({
      data: { success: true, access_info: { access_token: "tok" } },
    });
    mocks.verify.mockResolvedValue({
      data: { success: true, current_semester: 4 },
    });
    mocks.getRoads.mockResolvedValue({
      status: 200,
      data: { success: true, files: {} },
    });
    useCourseDataStore().disallowCookies();
    const auth = useAuthStore();

    auth.attemptLogin();

    await vi.waitFor(() => expect(auth.loggedIn).toBe(true));
    expect(readValue(STORAGE_KEYS.accessInfo)).toBeUndefined();
  });

  it("reports a failed redemption instead of failing silently", async () => {
    window.history.replaceState({}, "", "/?code=bad");
    mocks.fetchToken.mockRejectedValue(new Error("Network Error"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const auth = useAuthStore();

    auth.attemptLogin();

    await vi.waitFor(() =>
      expect(toast.state.toasts.map((t) => t.message)).toContain(
        "Couldn't log you in. Try again.",
      ),
    );
    expect(auth.loggedIn).toBe(false);
    expect(mocks.setFireroadToken).not.toHaveBeenCalled();
  });

  it("does nothing on a plain visit with no code and no prior login", () => {
    const auth = useAuthStore();

    auth.attemptLogin();

    expect(mocks.fetchToken).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(auth.loggedIn).toBe(false);
  });
});
