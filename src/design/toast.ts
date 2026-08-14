/**
 * Toast service with a first-class undo affordance.
 *
 * Design rule: destructive actions are confirmed with *undo*, not with
 * interrogation dialogs. `toast.undoable("Road deleted", restoreFn)` is
 * the canonical pattern: the action happens immediately and the student
 * has a calm window to take it back.
 */

import { reactive, readonly } from "vue";

export interface ToastAction {
  label: string;
  handler: () => void;
}

export interface Toast {
  id: number;
  message: string;
  detail?: string;
  variant: "neutral" | "ok" | "warn" | "danger";
  action?: ToastAction;
  /** ms; undo toasts default longer so there's time to react. */
  duration: number;
}

let nextId = 1;

const state = reactive({
  toasts: [] as Toast[],
});

function dismiss(id: number): void {
  const index = state.toasts.findIndex((t) => t.id === id);
  if (index >= 0) {
    state.toasts.splice(index, 1);
  }
}

function push(toast: Omit<Toast, "id">): number {
  const id = nextId++;
  state.toasts.push({ ...toast, id });
  // Keep at most 3 visible; oldest yields first.
  while (state.toasts.length > 3) {
    state.toasts.shift();
  }
  return id;
}

export const toast = {
  state: readonly(state),
  dismiss,

  show(
    message: string,
    options: Partial<Omit<Toast, "id" | "message">> = {},
  ): number {
    return push({
      message,
      detail: options.detail,
      variant: options.variant ?? "neutral",
      action: options.action,
      duration: options.duration ?? 4000,
    });
  },

  ok(message: string, detail?: string): number {
    return push({ message, detail, variant: "ok", duration: 3500 });
  },

  warn(message: string, detail?: string): number {
    return push({ message, detail, variant: "warn", duration: 5000 });
  },

  danger(message: string, detail?: string): number {
    return push({ message, detail, variant: "danger", duration: 6000 });
  },

  /** The undo pattern: act immediately, offer a calm way back. */
  undoable(message: string, onUndo: () => void, detail?: string): number {
    const id = push({
      message,
      detail,
      variant: "neutral",
      duration: 8000,
      action: {
        label: "Undo",
        handler: () => {
          onUndo();
          dismiss(id);
        },
      },
    });
    return id;
  },
};
