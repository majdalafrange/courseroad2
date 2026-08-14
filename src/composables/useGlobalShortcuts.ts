/**
 * The window-level keyboard chords, with their lifecycle handled:
 * listeners attach on mount and detach on unmount. Cmd/Ctrl+K toggles
 * the palette; Cmd/Ctrl+Z and Shift reverse run the history service.
 * Everything else stays element-scoped or on its own escape layering.
 */

import { onBeforeUnmount, onMounted } from "vue";

interface GlobalShortcutHandlers {
  togglePalette: () => void;
  undo: () => void;
  redo: () => void;
}

function isEditableTarget(event: KeyboardEvent): boolean {
  const el = event.target as HTMLElement | null;
  if (!el) {
    return false;
  }
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

export function useGlobalShortcuts(handlers: GlobalShortcutHandlers): void {
  function onKeydown(event: KeyboardEvent) {
    const mod = event.metaKey || event.ctrlKey;
    if (!mod) {
      return;
    }
    if (event.key.toLowerCase() === "k") {
      event.preventDefault();
      handlers.togglePalette();
      return;
    }
    if (event.key.toLowerCase() === "z" && !isEditableTarget(event)) {
      event.preventDefault();
      if (event.shiftKey) {
        handlers.redo();
      } else {
        handlers.undo();
      }
    }
  }

  onMounted(() => window.addEventListener("keydown", onKeydown));
  onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
}
