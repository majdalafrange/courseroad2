<template>
  <div class="g-toast-host" aria-live="polite">
    <transition-group name="g-toast">
      <div
        v-for="t in toast.state.toasts"
        :key="t.id"
        class="g-toast"
        :class="t.variant"
        @mouseenter="pause(t.id)"
        @mouseleave="resume(t)"
      >
        <span class="g-toast-rail" aria-hidden="true" />
        <div class="g-toast-body">
          <span class="g-toast-message">{{ t.message }}</span>
          <span v-if="t.detail" class="g-toast-detail">{{ t.detail }}</span>
        </div>
        <button
          v-if="t.action"
          class="g-toast-action"
          @click="t.action.handler()"
        >
          {{ t.action.label }}
        </button>
        <button
          class="g-toast-dismiss"
          aria-label="Dismiss"
          @click="toast.dismiss(t.id)"
        >
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <path
              d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { watch } from "vue";
import { toast, type Toast } from "../toast";

const timers = new Map<number, ReturnType<typeof setTimeout>>();

function schedule(t: Toast | { id: number; duration: number }) {
  clear(t.id);
  timers.set(
    t.id,
    setTimeout(() => {
      toast.dismiss(t.id);
      timers.delete(t.id);
    }, t.duration),
  );
}

function clear(id: number) {
  const timer = timers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(id);
  }
}

function pause(id: number) {
  clear(id);
}

function resume(t: { id: number; duration: number }) {
  schedule(t);
}

watch(
  () => toast.state.toasts.map((t) => t.id),
  (ids, oldIds) => {
    for (const id of ids) {
      if (!oldIds || !oldIds.includes(id)) {
        const t = toast.state.toasts.find((x) => x.id === id);
        if (t) {
          schedule(t);
        }
      }
    }
    if (oldIds) {
      for (const id of oldIds) {
        if (!ids.includes(id)) {
          clear(id);
        }
      }
    }
  },
);
</script>

<style scoped>
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
  pointer-events: none;
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
  flex-direction: column;
  gap: var(--space-05);
  padding: var(--space-1) 0;
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

/* Toasts rise into place and settle; leaving slides down and fades. */
.g-toast-enter-active {
  transition:
    opacity var(--motion-standard) var(--ease-out),
    transform var(--motion-standard) var(--ease-settle);
}
.g-toast-leave-active {
  transition:
    opacity var(--motion-quick) var(--ease-in),
    transform var(--motion-quick) var(--ease-in);
}
.g-toast-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}
.g-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
