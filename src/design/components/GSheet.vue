<template>
  <DialogRoot :open="modelValue" modal @update:open="onUpdateOpen">
    <DialogPortal>
      <DialogOverlay
        class="g-sheet-scrim"
        :class="{ opaque: scrim === 'opaque' }"
      />
      <DialogContent
        class="g-sheet-panel"
        :style="{ width }"
        :aria-describedby="undefined"
        v-bind="$attrs"
        @escape-key-down="onEscapeKeyDown"
        @interact-outside="onInteractOutside"
      >
        <VisuallyHidden as-child>
          <DialogTitle>{{ label }}</DialogTitle>
        </VisuallyHidden>
        <button
          v-if="closeButton && dismissible"
          class="g-sheet-close"
          aria-label="Close"
          @click="close"
        >
          <g-icon name="close" :size="16" />
        </button>
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
/*
 * The modal sheet primitive: scrim, panel, and the keyboard contract every
 * modal owes. Focus trapping, body-scroll locking, and returning focus to
 * whatever had it before opening are all Reka UI's Dialog (it captures
 * `document.activeElement` itself when content mounts, since there's no
 * `DialogTrigger` here: every caller opens this from its own separate
 * button, not a slot inside this component). This file adds only the one
 * behavior that's specific to how this app's layers cooperate: Escape
 * closes one layer, so it's marked consumed for window-level listeners
 * (canvas, class detail) instead of also bubbling to them.
 */
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  VisuallyHidden,
  type FocusOutsideEvent,
  type PointerDownOutsideEvent,
} from "reka-ui";
import GIcon from "./GIcon.vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    /** Accessible dialog name. */
    label: string;
    /** Panel width; the panel never exceeds the viewport. */
    width?: string;
    closeButton?: boolean;
    /**
     * false for forced-choice dialogs (sync-conflict resolution): Escape
     * and scrim clicks do nothing, and no close button renders. The trap
     * and focus restore still apply.
     */
    dismissible?: boolean;
    /** "opaque" for full takeovers (first-run onboarding). */
    scrim?: "default" | "opaque";
  }>(),
  { width: "560px", closeButton: true, dismissible: true, scrim: "default" },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

function close() {
  if (props.dismissible) {
    emit("update:modelValue", false);
  }
}

// Reka's own dismiss (Escape, outside click) always calls this; forward
// it as-is (blocked below for a non-dismissible sheet before it fires).
function onUpdateOpen(open: boolean) {
  emit("update:modelValue", open);
}

function onEscapeKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented) {
    // Already consumed by an inner layer (a popover open on top of this
    // sheet); one Escape closes one layer, so this one sits still.
    return;
  }
  if (!props.dismissible) {
    // Block Reka's own auto-dismiss; a forced-choice sheet ignores Escape.
    event.preventDefault();
    return;
  }
  // Mark it consumed so window-level listeners (canvas, class detail)
  // skip this keypress too.
  event.preventDefault();
  close();
}

function onInteractOutside(event: PointerDownOutsideEvent | FocusOutsideEvent) {
  if (!props.dismissible) {
    event.preventDefault();
  }
}
</script>

<style>
/* Not scoped: see GPopover.vue's note. DialogContent/DialogOverlay are
   teleported through several layers of Reka's own components, and Vue's
   scoped-CSS attribute doesn't reliably survive that chain. */
.g-sheet-scrim {
  position: fixed;
  inset: 0;
  background: var(--g-scrim);
  z-index: 100;
}
.g-sheet-scrim.opaque {
  background: var(--g-bg);
}
.g-sheet-scrim[data-state="open"] {
  animation: g-sheet-fade-in var(--motion-standard) var(--ease-out);
}
/* An opaque scrim is a full takeover (first-run onboarding): whatever it
   covers must never be visible through it, not even for a fade-in's
   first frame, so it skips the animation and appears instantly. */
.g-sheet-scrim.opaque[data-state="open"] {
  animation: none;
}
.g-sheet-scrim[data-state="closed"] {
  animation: g-sheet-fade-out var(--motion-quick) var(--ease-in);
}

.g-sheet-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 64px);
  background: var(--g-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-3);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  outline: none;
  z-index: 100;
}
.g-sheet-panel[data-state="open"] {
  animation: g-sheet-fade-in var(--motion-standard) var(--ease-out);
}
.g-sheet-panel[data-state="closed"] {
  animation: g-sheet-fade-out var(--motion-quick) var(--ease-in);
}
@keyframes g-sheet-fade-in {
  from {
    opacity: 0;
  }
}
@keyframes g-sheet-fade-out {
  to {
    opacity: 0;
  }
}

.g-sheet-close {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--g-surface);
  color: var(--g-ink-3);
  cursor: pointer;
  z-index: 1;
  box-shadow: var(--shadow-1);
}
.g-sheet-close:hover {
  color: var(--g-ink);
}
</style>
