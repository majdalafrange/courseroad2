<template>
  <DialogRoot
    :open="true"
    :modal="false"
    @update:open="(open: boolean) => open || emit('close')"
  >
    <DialogContent
      :as="as"
      class="base-inline-dialog"
      v-bind="{
        ...$attrs,
        ...(describedBy ? {} : { 'aria-describedby': undefined }),
      }"
      @open-auto-focus="onOpenAutoFocus"
      @interact-outside="onInteractOutside"
      @close-auto-focus="onCloseAutoFocus"
    >
      <slot />
    </DialogContent>
  </DialogRoot>
</template>

<script setup lang="ts">
/**
 * A non-modal dialog laid out in place (Reka's Dialog, not portaled). Mount
 * it with v-if; it emits "close" on Escape and returns focus on unmount.
 * Outside clicks don't close it, and after one, closing leaves focus there.
 */
import {
  DialogContent,
  DialogRoot,
  type FocusOutsideEvent,
  type PointerDownOutsideEvent,
} from "reka-ui";

// DialogRoot has no element, so attrs (a class) go to the content by hand.
defineOptions({ inheritAttrs: false });

const {
  as = "section",
  initialFocus = undefined,
  describedBy = false,
} = defineProps<{
  as?: string;
  /** Selector for the element to focus on open; else the first
   *  focusable one. */
  initialFocus?: string;
  /** A BaseInlineDialogDescription is rendered. */
  describedBy?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

function onOpenAutoFocus(event: Event) {
  if (initialFocus === undefined) {
    return;
  }
  const target = (event.target as HTMLElement).querySelector<HTMLElement>(
    initialFocus,
  );
  if (target) {
    event.preventDefault();
    target.focus();
  }
}

let clickedOutside = false;
function onInteractOutside(event: PointerDownOutsideEvent | FocusOutsideEvent) {
  if (event.detail.originalEvent.type === "pointerdown") {
    clickedOutside = true;
  }
  event.preventDefault();
}
function onCloseAutoFocus(event: Event) {
  if (clickedOutside) {
    event.preventDefault();
  }
}
</script>

<style scoped>
/* A raised panel: its elevation sets it apart, not a cardinal edge. The
   caller places it (margin, flex) from a wrapper of its own; the panel
   element is Reka's and a caller's scoped class would not reach it. */
.base-inline-dialog {
  padding: var(--space-3);
  background: var(--base-surface);
  border: 1px solid var(--base-line-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-2);
}
.base-inline-dialog:focus-visible {
  outline: none;
  box-shadow: var(--base-focus-ring);
}
</style>
