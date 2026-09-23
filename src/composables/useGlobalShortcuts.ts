/**
 * Window-level keyboard shortcuts: Cmd/Ctrl+K opens the palette; Cmd/Ctrl+Z
 * and Shift+Z run the history service, Cmd/Ctrl+Y is redo on Windows.
 * Every one is a chord: a bare character key would fire from speech input
 * and stray keypresses, with no way to turn it off (WCAG 2.1.4).
 * Listeners attach on mount and detach on unmount.
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

// Focus inside a sheet, drawer, popover or menu: the shortcuts would
// change what the student cannot see.
function isInsideOverlay(event: KeyboardEvent): boolean {
  const target = event.target;
  return (
    target instanceof HTMLElement &&
    target.closest('[role="dialog"], [role="menu"]') !== null
  );
}

export function useGlobalShortcuts(handlers: GlobalShortcutHandlers): void {
  function onKeydown(event: KeyboardEvent) {
    if (isInsideOverlay(event)) {
      return;
    }
    const mod = event.metaKey || event.ctrlKey;
    if (!mod) {
      return;
    }
    // Works from a text field too: it is a chord, so it can't be typing.
    if (event.key.toLowerCase() === "k" && !event.shiftKey && !event.altKey) {
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
    if (event.key.toLowerCase() === "y" && !isEditableTarget(event)) {
      event.preventDefault();
      handlers.redo();
    }
  }

  onMounted(() => window.addEventListener("keydown", onKeydown));
  onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
}
