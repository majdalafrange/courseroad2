/**
 * The window-level keyboard shortcuts, with their lifecycle handled:
 * listeners attach on mount and detach on unmount. "/" opens the palette;
 * Cmd/Ctrl+Z and Shift reverse run the history service, with Cmd/Ctrl+Y as
 * the Windows spelling of redo. Everything else stays element-scoped or on
 * its own escape layering.
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

// Focus inside a sheet, drawer or popover means the student is acting on
// that layer, not the plan behind it: opening the palette or undoing from
// there would change what they cannot see or reach.
function isInsideOverlay(event: KeyboardEvent): boolean {
  const target = event.target;
  return (
    target instanceof HTMLElement && target.closest('[role="dialog"]') !== null
  );
}

export function useGlobalShortcuts(handlers: GlobalShortcutHandlers): void {
  function onKeydown(event: KeyboardEvent) {
    if (isInsideOverlay(event)) {
      return;
    }
    if (event.key.toLowerCase() === "/" && !isEditableTarget(event)) {
      event.preventDefault();
      handlers.togglePalette();
      return;
    }
    const mod = event.metaKey || event.ctrlKey;
    if (!mod) {
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
    if (event.key.toLowerCase() === "y" && !isEditableTarget(event)) {
      event.preventDefault();
      handlers.redo();
    }
  }

  onMounted(() => window.addEventListener("keydown", onKeydown));
  onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
}
