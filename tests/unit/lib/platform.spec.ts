// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { isMac, shortcutLabel } from "../../../src/lib/platform";

function stubUserAgent(ua: string): void {
  Object.defineProperty(navigator, "userAgent", {
    value: ua,
    configurable: true,
  });
}

const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const WINDOWS_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const LINUX_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const originalUserAgent = navigator.userAgent;

afterEach(() => {
  stubUserAgent(originalUserAgent);
});

describe("isMac / shortcutLabel", () => {
  it("reads Mac as Cmd, no separator", () => {
    stubUserAgent(MAC_UA);
    expect(isMac()).toBe(true);
    expect(shortcutLabel("K")).toBe("⌘K");
  });

  it("reads Windows as Ctrl, with a plus", () => {
    stubUserAgent(WINDOWS_UA);
    expect(isMac()).toBe(false);
    expect(shortcutLabel("K")).toBe("Ctrl+K");
  });

  it("reads Linux as Ctrl, with a plus", () => {
    stubUserAgent(LINUX_UA);
    expect(isMac()).toBe(false);
    expect(shortcutLabel("K")).toBe("Ctrl+K");
  });
});
