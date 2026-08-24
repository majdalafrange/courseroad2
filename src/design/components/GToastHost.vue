<template>
  <ToastProvider swipe-direction="right">
    <ToastRoot
      v-for="t in toast.state.toasts"
      :key="t.id"
      class="g-toast"
      :class="t.variant"
      :duration="t.duration"
      @update:open="(open) => !open && toast.dismiss(t.id)"
    >
      <span class="g-toast-rail" aria-hidden="true" />
      <div class="g-toast-body">
        <ToastTitle as="span" class="g-toast-message">{{
          t.message
        }}</ToastTitle>
        <ToastDescription v-if="t.detail" as="span" class="g-toast-detail">
          {{ t.detail }}
        </ToastDescription>
      </div>
      <ToastAction
        v-if="t.action"
        class="g-toast-action"
        :alt-text="t.action.label"
        @click="t.action.handler()"
      >
        {{ t.action.label }}
      </ToastAction>
      <ToastClose class="g-toast-dismiss" aria-label="Dismiss">
        <g-icon name="close" :size="10" />
      </ToastClose>
    </ToastRoot>
    <ToastPortal>
      <ToastViewport class="g-toast-host" />
    </ToastPortal>
  </ToastProvider>
</template>

<script setup lang="ts">
/*
 * Auto-dismiss timing, pause-on-hover/focus/window-blur, and swipe-to-
 * dismiss are all Reka UI's Toast; this file is the visual skin plus the
 * one bit of glue Reka can't own: toast.state.toasts is the source of
 * truth (see ../toast.ts), so a toast closing (by timeout, swipe, or the
 * close button) just removes it from that array instead of tracking its
 * own open state.
 */
import {
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastPortal,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
} from "reka-ui";
import GIcon from "./GIcon.vue";
import { toast } from "../toast";
</script>

<style>
/* Not scoped: see GPopover.vue's note. ToastRoot teleports into the
   viewport element, which itself teleports through ToastPortal, so
   scoped CSS has two teleport hops to survive rather than one. */
.g-toast-host {
  position: fixed;
  bottom: var(--space-5);
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  list-style: none;
  margin: 0;
  padding: 0;
  outline: none;
}
.g-toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--g-surface);
  color: var(--g-ink);
  border: 1px solid var(--g-overlay-line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-3);
  padding: var(--space-2) var(--space-3) var(--space-2) 0;
  min-width: 260px;
  max-width: 480px;
  overflow: hidden;
}
.g-toast-rail {
  align-self: stretch;
  width: 3px;
  border-radius: var(--radius-full);
  margin-right: var(--space-1);
  background: var(--g-ink-3);
  flex-shrink: 0;
}
.g-toast.ok .g-toast-rail {
  background: var(--g-ok);
}
.g-toast.warn .g-toast-rail {
  background: var(--g-warn);
}
.g-toast.danger .g-toast-rail {
  background: var(--g-danger);
}
.g-toast-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--space-05);
  padding: var(--space-1) 0;
  min-width: 0;
}
.g-toast-message {
  font: var(--text-body-strong);
}
.g-toast-detail {
  font: var(--text-small);
  color: var(--g-ink-2);
}
.g-toast-action {
  font: var(--text-body-strong);
  color: var(--g-accent);
  background: transparent;
  border: none;
  border-radius: var(--radius-xs);
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
  white-space: nowrap;
}
.g-toast-action:hover {
  background: var(--g-accent-tint);
}
.g-toast-action:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
.g-toast-dismiss {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--g-ink-3);
  cursor: pointer;
  flex-shrink: 0;
}
.g-toast-dismiss:hover {
  color: var(--g-ink);
  background: var(--g-surface-sunken);
}

/* clear the fixed bottom navigation on small screens */
@media (max-width: 859px) {
  .g-toast-host {
    bottom: calc(var(--space-4) + 56px + env(safe-area-inset-bottom, 0px));
  }
}

/* Toasts rise into place and settle; timing out or the close button fades
   and slides down. A swipe dismiss (data-swipe="end") gets its own exit
   so it flies out the direction it was dragged instead of fighting the
   timeout animation; data-state still flips to "closed" at the same
   moment, so the two are scoped to not both apply. */
.g-toast[data-state="open"] {
  animation: g-toast-in var(--motion-standard) var(--ease-settle);
}
.g-toast[data-state="closed"]:not([data-swipe="end"]) {
  animation: g-toast-out var(--motion-quick) var(--ease-in);
}
@keyframes g-toast-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }
}
@keyframes g-toast-out {
  to {
    opacity: 0;
    transform: translateY(8px);
  }
}

.g-toast[data-swipe="move"] {
  transform: translateX(var(--reka-toast-swipe-move-x));
}
.g-toast[data-swipe="cancel"] {
  transform: translateX(0);
  transition: transform var(--motion-quick) var(--ease-out);
}
.g-toast[data-swipe="end"] {
  animation: g-toast-swipe-out var(--motion-quick) var(--ease-in) forwards;
}
@keyframes g-toast-swipe-out {
  from {
    transform: translateX(var(--reka-toast-swipe-end-x));
  }
  to {
    opacity: 0;
    transform: translateX(calc(100% + var(--space-3)));
  }
}
</style>
