/**
 * Screen-reader announcer. A single polite live region (mounted by
 * GLiveRegion) reads these messages so non-visual users hear what
 * changed: a requirement completing, a save finishing, a class placed.
 */

import { ref } from "vue";

export const liveMessage = ref("");

let clearTimer: ReturnType<typeof setTimeout> | undefined;

/** Announce a message politely (deduped re-announce via a brief clear). */
export function announce(message: string): void {
  if (clearTimer !== undefined) {
    clearTimeout(clearTimer);
  }
  // Clear then set so identical consecutive messages are still announced.
  liveMessage.value = "";
  requestAnimationFrame(() => {
    liveMessage.value = message;
    clearTimer = setTimeout(() => {
      liveMessage.value = "";
    }, 1000);
  });
}
