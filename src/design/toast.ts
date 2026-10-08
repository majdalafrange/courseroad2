/**
 * Toast service with a first-class undo affordance: destructive actions
 * are confirmed with undo (`toast.undoable`), not dialogs. Toasts travel
 * to GToastHost through Reka's toast manager; `state.toasts` mirrors the
 * open ones so stores can ask whether a toast is still showing.
 */

import { reactive, readonly } from "vue";
import { createToastManager } from "reka-ui";

export interface ToastAction {
  label: string;
  handler: () => void;
}

export type ToastVariant = "neutral" | "ok" | "warn" | "danger";

export interface Toast {
  id: string;
  message: string;
  detail?: string;
  variant: ToastVariant;
  action?: ToastAction;
  /** ms; undo toasts default longer so there's time to react. */
  duration: number;
}

/** What GToastList reads off each managed toast's `data`. */
export interface ToastData {
  variant: ToastVariant;
}

export const toastManager = createToastManager<ToastData>();

const state = reactive({
  toasts: [] as Toast[],
});

function forget(id: string): void {
  const index = state.toasts.findIndex((t) => t.id === id);
  if (index >= 0) {
    state.toasts.splice(index, 1);
  }
}

function dismiss(id: string): void {
  forget(id);
  toastManager.close(id);
}

function push(toast: Omit<Toast, "id">): string {
  const id: string = toastManager.add({
    title: toast.message,
    description: toast.detail,
    duration: toast.duration,
    data: { variant: toast.variant },
    actionProps:
      toast.action === undefined
        ? undefined
        : {
            label: toast.action.label,
            altText: toast.action.label,
            onClick: toast.action.handler,
          },
    // Reka closes it on a timeout, a swipe or the close button.
    onClose: (): void => forget(id),
  });
  state.toasts.push({ ...toast, id });
  // Keep at most 3 visible, evicting a plain toast before an undoable one.
  while (state.toasts.length > 3) {
    const evict =
      state.toasts.find((t) => t.action === undefined) ?? state.toasts[0];
    dismiss(evict.id);
  }
  return id;
}

export const toast = {
  state: readonly(state),
  dismiss,

  show(
    message: string,
    options: Partial<Omit<Toast, "id" | "message">> = {},
  ): string {
    return push({
      message,
      detail: options.detail,
      variant: options.variant ?? "neutral",
      action: options.action,
      duration: options.duration ?? 4000,
    });
  },

  ok(message: string, detail?: string): string {
    return push({ message, detail, variant: "ok", duration: 3500 });
  },

  warn(message: string, detail?: string): string {
    return push({ message, detail, variant: "warn", duration: 5000 });
  },

  danger(message: string, detail?: string): string {
    return push({ message, detail, variant: "danger", duration: 6000 });
  },

  /** Act immediately, offer a way back. The action closes the toast. */
  undoable(message: string, onUndo: () => void, detail?: string): string {
    return push({
      message,
      detail,
      variant: "neutral",
      duration: 8000,
      action: { label: "Undo", handler: onUndo },
    });
  },
};
