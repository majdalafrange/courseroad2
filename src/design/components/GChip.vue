<template>
  <span
    class="g-chip"
    :class="{ interactive, selected }"
    :style="deptStyle"
    :tabindex="interactive ? 0 : undefined"
    :role="interactive ? 'button' : undefined"
  >
    <span class="g-chip-label"><slot /></span>
    <button
      v-if="closable"
      class="g-chip-close"
      aria-label="Remove"
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

const props = withDefaults(
  defineProps<{
    /** Department color key, e.g. "course-6"; colors the chip. */
    dept?: string;
    closable?: boolean;
    interactive?: boolean;
    selected?: boolean;
  }>(),
  {
    dept: undefined,
    closable: false,
    interactive: false,
    selected: false,
  },
);

const emit = defineEmits<{
  (e: "close"): void;
}>();

const deptStyle = computed(() =>
  props.dept !== undefined
    ? {
        backgroundColor: `var(--dept-${props.dept})`,
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
.g-chip.interactive:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
.g-chip.selected {
  background: var(--g-accent);
  color: var(--g-on-accent);
}
.g-chip-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin-right: -2px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  padding: 0;
}
.g-chip-close:hover {
  opacity: 1;
  /* follows the chip's own text color, so it reads correctly on department
     chips and neutral chips in both themes (was hard-coded black) */
  background: color-mix(in srgb, currentColor 18%, transparent);
}
.g-chip-close:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
</style>
