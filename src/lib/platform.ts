import { UAParser } from "ua-parser-js";

/**
 * Keyboard-shortcut display: Cmd on a Mac, Ctrl elsewhere
 * (useGlobalShortcuts accepts both). ua-parser-js instead of the
 * deprecated navigator.platform.
 */
export function isMac(): boolean {
  return /mac/i.test(UAParser(navigator.userAgent).os.name ?? "");
}

/** Flat "⌘K"/"Ctrl+K" string for plain-text contexts (toasts) that can't
 *  hold real <kbd> markup; GKbd + shortcutKeys is the markup version. */
export function shortcutLabel(key: string): string {
  const { keys, joiner } = shortcutKeys(key);
  return keys.join(joiner);
}

/** The individual keys and the text between them, for <g-kbd :keys>. */
export interface ShortcutKeys {
  keys: string[];
  joiner: string;
}

/** Same shortcut, split into parts a <g-kbd> can nest one <kbd> per key
 *  around (the HTML spec's own convention for a combination). */
export function shortcutKeys(key: string): ShortcutKeys {
  return isMac()
    ? { keys: ["⌘", key], joiner: "" }
    : { keys: ["Ctrl", key], joiner: "+" };
}
