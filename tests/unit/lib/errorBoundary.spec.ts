// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// The module holds a "reloading" flag, so each test gets a fresh copy.
async function freshModule() {
  vi.resetModules();
  return import("../../../src/lib/errorBoundary");
}

describe("isChunkLoadError", () => {
  it("matches each browser's wording for a failed dynamic import", async () => {
    const { isChunkLoadError } = await freshModule();
    expect(
      isChunkLoadError(
        new TypeError(
          "Failed to fetch dynamically imported module: http://x/assets/a.js",
        ),
      ),
    ).toBe(true);
    expect(
      isChunkLoadError(
        new TypeError("error loading dynamically imported module"),
      ),
    ).toBe(true);
    expect(
      isChunkLoadError(new TypeError("Importing a module script failed.")),
    ).toBe(true);
    expect(
      isChunkLoadError(new Error("Unable to preload CSS for /assets/a.css")),
    ).toBe(true);
  });

  it("leaves other errors alone", async () => {
    const { isChunkLoadError } = await freshModule();
    expect(isChunkLoadError(new Error("Network Error"))).toBe(false);
    expect(isChunkLoadError(new TypeError("x is not a function"))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe("recoverFromChunkLoadError", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it("reloads once and records when", async () => {
    const { recoverFromChunkLoadError, fatalError } = await freshModule();
    const reload = vi.fn();

    recoverFromChunkLoadError(reload);

    expect(reload).toHaveBeenCalledOnce();
    expect(fatalError.value).toBe(false);
    expect(Number(sessionStorage.getItem("chunkReloadAt"))).toBeGreaterThan(0);
  });

  it("does not act twice while the reload is under way", async () => {
    const { recoverFromChunkLoadError } = await freshModule();
    const reload = vi.fn();

    recoverFromChunkLoadError(reload);
    recoverFromChunkLoadError(reload);

    expect(reload).toHaveBeenCalledOnce();
  });

  it("falls through to the fatal screen when the last reload was recent", async () => {
    sessionStorage.setItem("chunkReloadAt", String(Date.now() - 5_000));
    const { recoverFromChunkLoadError, fatalError } = await freshModule();
    const reload = vi.fn();

    recoverFromChunkLoadError(reload);

    expect(reload).not.toHaveBeenCalled();
    expect(fatalError.value).toBe(true);
  });

  it("retries again once the window has passed", async () => {
    sessionStorage.setItem("chunkReloadAt", String(Date.now() - 60_000));
    const { recoverFromChunkLoadError, fatalError } = await freshModule();
    const reload = vi.fn();

    recoverFromChunkLoadError(reload);

    expect(reload).toHaveBeenCalledOnce();
    expect(fatalError.value).toBe(false);
  });

  it("shows the fatal screen instead of looping where storage is blocked", async () => {
    const { recoverFromChunkLoadError, fatalError } = await freshModule();
    const reload = vi.fn();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    recoverFromChunkLoadError(reload);

    expect(reload).not.toHaveBeenCalled();
    expect(fatalError.value).toBe(true);
    vi.restoreAllMocks();
  });
});
