<template>
  <ToastProvider swipe-direction="right" :toast-manager="toastManager">
    <BaseToastList />
    <ToastPortal>
      <ToastViewport class="base-toast-host" />
    </ToastPortal>
  </ToastProvider>
</template>

<script setup lang="ts">
/*
 * Auto-dismiss timing, pause-on-hover/focus/blur, and swipe-to-dismiss
 * are Reka UI's Toast; this is the visual skin. Toasts arrive through
 * the toast manager in ../toast.ts.
 */
import { ToastPortal, ToastProvider, ToastViewport } from "reka-ui";
import BaseToastList from "./BaseToastList.vue";
import { toastManager } from "../../toast.ts";
</script>

<style>
/* Not scoped: see BasePopover.vue's note. ToastRoot teleports into the
   viewport element, which itself teleports through ToastPortal, so
   scoped CSS has two teleport hops to survive rather than one. */
/* Inset from both edges: left: 50% capped a toast at half the screen.
   Click-through, so the strips beside a toast stay usable. */
.base-toast-host {
  position: fixed;
  bottom: var(--space-5);
  left: var(--space-3);
  right: var(--space-3);
  pointer-events: none;
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
.base-toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--base-surface);
  color: var(--base-ink);
  border: 1px solid var(--base-overlay-line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-3);
  padding: var(--space-2) var(--space-3);
  min-width: min(260px, 100%);
  max-width: 480px;
  overflow: hidden;
}
/* Level with the message's first line, not centered on a two-line toast. */
.base-toast-icon {
  align-self: flex-start;
  flex-shrink: 0;
  margin-top: calc(var(--space-1) + 3px);
  margin-right: calc(var(--space-1) * -1);
}
.base-toast.ok .base-toast-icon {
  color: var(--base-ok);
}
.base-toast.warn .base-toast-icon {
  color: var(--base-warn);
}
.base-toast.danger .base-toast-icon {
  color: var(--base-danger);
}
.base-toast-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--space-05);
  padding: var(--space-1) 0;
  min-width: 0;
}
.base-toast-message {
  font: var(--text-body-strong);
}
.base-toast-detail {
  font: var(--text-small);
  color: var(--base-ink-2);
}
.base-toast-action {
  font: var(--text-body-strong);
  color: var(--base-accent);
  background: transparent;
  border: none;
  border-radius: var(--radius-xs);
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
  white-space: nowrap;
}
.base-toast-action:hover {
  background: var(--base-accent-tint);
}
.base-toast-action:focus-visible {
  outline: none;
  box-shadow: var(--base-focus-ring);
}
.base-toast-dismiss {
  /* 24px: the minimum target size (WCAG 2.5.8) */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--base-ink-3);
  cursor: pointer;
  flex-shrink: 0;
}
.base-toast-dismiss:hover {
  color: var(--base-ink);
  background: var(--base-surface-sunken);
}

/* clear the fixed bottom navigation on small screens */
@media (max-width: 859px) {
  .base-toast-host {
    bottom: calc(
      var(--space-4) + var(--mobile-nav-height) +
        env(safe-area-inset-bottom, 0px)
    );
  }
}

/* Toasts rise into place; timing out or the close button fades and slides
   down. A swipe dismiss (data-swipe="end") exits in the direction it was
   dragged; data-state flips to "closed" at the same moment, so the two
   are scoped not to both apply. */
.base-toast[data-state="open"] {
  animation: base-toast-in var(--motion-standard) var(--ease-settle);
}
.base-toast[data-state="closed"]:not([data-swipe="end"]) {
  animation: base-toast-out var(--motion-quick) var(--ease-in);
}
@keyframes base-toast-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }
}
@keyframes base-toast-out {
  to {
    opacity: 0;
    transform: translateY(8px);
  }
}

.base-toast[data-swipe="move"] {
  transform: translateX(var(--reka-toast-swipe-move-x));
}
.base-toast[data-swipe="cancel"] {
  transform: translateX(0);
  transition: transform var(--motion-quick) var(--ease-out);
}
.base-toast[data-swipe="end"] {
  animation: base-toast-swipe-out var(--motion-quick) var(--ease-in) forwards;
}
@keyframes base-toast-swipe-out {
  from {
    transform: translateX(var(--reka-toast-swipe-end-x));
  }
  to {
    opacity: 0;
    transform: translateX(calc(100% + var(--space-3)));
  }
}
</style>
