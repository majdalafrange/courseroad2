<template>
  <!-- The label and the close control are sibling buttons: a close button
       nested inside a role="button" chip is flattened out of reach by
       screen readers. A click on the label bubbles to this root, so a
       caller's @click still lands. -->
  <span class="g-chip" :class="{ interactive, selected }" :style="deptStyle">
    <button
      v-if="interactive"
      type="button"
      class="g-chip-label g-chip-action"
      :aria-pressed="selected"
    >
      <slot />
    </button>
    <span v-else class="g-chip-label"><slot /></span>
    <button
      v-if="closable"
      type="button"
      class="g-chip-close"
      :aria-label="removeLabel"
      @click.stop="emit('close')"
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
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const {
  dept = undefined,
  closable = false,
  interactive = false,
  selected = undefined,
  removeLabel = "Remove",
} = defineProps<{
  /** Department color key, e.g. "course-6"; colors the chip. */
  dept?: string;
  closable?: boolean;
  /** The close button's name; name the thing, e.g. "Remove 6-3 Major". */
  removeLabel?: string;
  interactive?: boolean;
  /** Set (true or false) only on a toggle chip: it adds aria-pressed.
   *  Left unset, an interactive chip is a plain action button. */
  selected?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const deptStyle = computed(() =>
  dept !== undefined
    ? {
        backgroundColor: `var(--dept-${dept})`,
        color: "var(--dept-on)",
      }
    : undefined,
);
</script>

<style scoped>
.g-chip {
  font: var(--text-small);
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  height: 24px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-full);
  background: var(--g-surface-sunken);
  color: var(--g-ink-2);
  user-select: none;
  white-space: nowrap;
  transition:
    background-color var(--motion-quick) var(--ease-out),
    box-shadow var(--motion-quick) var(--ease-out);
}
.g-chip.interactive {
  cursor: pointer;
}
.g-chip.interactive:hover {
  background: var(--g-accent-tint);
  color: var(--g-ink);
}
.g-chip:has(.g-chip-action:focus-visible) {
  box-shadow: var(--g-focus-ring);
}
.g-chip-action {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  padding: 0;
  cursor: inherit;
}
.g-chip-action:focus-visible {
  outline: none;
}
.g-chip.selected {
  background: var(--g-accent);
  color: var(--g-on-accent);
}
/* A 24px target (WCAG 2.5.8) that draws as the old 14px disc: the
   padding holds the extra, background-clip keeps the hover fill to the
   disc, and the negative margins keep the chip the size it was. */
.g-chip-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: 0 -7px 0 -5px;
  box-sizing: border-box;
  border: none;
  border-radius: var(--radius-full);
  background-color: transparent;
  /* after any background shorthand, which would reset it */
  background-clip: content-box;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  padding: 5px;
}
.g-chip-close:hover {
  opacity: 1;
  /* follows the chip's text color, so it reads on department and neutral
     chips in both themes */
  background-color: color-mix(in srgb, currentColor 18%, transparent);
}
.g-chip-close:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
</style>
