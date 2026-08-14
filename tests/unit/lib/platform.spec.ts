// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { isMac, shortcutLabel } from "../../../src/lib/platform";

function stubPlatform(platform: string): void {
  Object.defineProperty(navigator, "platform", {
    value: platform,
    configurable: true,
  });
}

const originalPlatform = navigator.platform;

afterEach(() => {
  stubPlatform(originalPlatform);
});

describe("isMac / shortcutLabel", () => {
  it("reads Mac as Cmd, no separator", () => {
    stubPlatform("MacIntel");
    expect(isMac()).toBe(true);
    expect(shortcutLabel("K")).toBe("⌘K");
  });

  it("reads Windows as Ctrl, with a plus", () => {
    stubPlatform("Win32");
    expect(isMac()).toBe(false);
    expect(shortcutLabel("K")).toBe("Ctrl+K");
  });

  it("reads Linux as Ctrl, with a plus", () => {
    stubPlatform("Linux x86_64");
    expect(isMac()).toBe(false);
    expect(shortcutLabel("K")).toBe("Ctrl+K");
  });
});
