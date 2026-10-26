<template>
  <RadioGroupItem
    class="base-radio-group-item"
    :class="{ 'base-choice': choice }"
    :value="value"
    :disabled="disabled"
  >
    <template #default="{ checked }">
      <RadioGroupIndicator as-child>
        <slot name="indicator" />
      </RadioGroupIndicator>
      <slot :checked="checked" />
    </template>
  </RadioGroupItem>
</template>

<script setup lang="ts" generic="T extends string | number">
/**
 * One option in a BaseRadioGroup. Content is the caller's via the default
 * slot's `checked`. The item element is a grandchild (Reka's
 * RadioGroupItem/Radio sit between), so a caller's class on it needs
 * :deep().
 */
import { RadioGroupItem, RadioGroupIndicator } from "reka-ui";

const { disabled = false, choice = false } = defineProps<{
  value: T;
  disabled?: boolean;
  choice?: boolean;
}>();
</script>

<style>
/* The `choice` tile: surface, edge and states only. Callers set font and
   layout, and height through --choice-min-height so the touch tier wins.
   Not scoped: the class lands on Reka's item, a grandchild. */
.base-choice {
  min-height: var(--choice-min-height, auto);
  color: var(--base-ink-2);
  background: var(--base-surface-2);
  border: 1.5px solid var(--base-line);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    border-color var(--motion-quick) var(--ease-out),
    color var(--motion-quick) var(--ease-out);
}
/* Touch tier (tokens.css). */
@media (max-width: 859px) and (pointer: coarse) {
  .base-choice {
    min-height: 44px;
  }
}
.base-choice:hover {
  border-color: var(--base-line-strong);
  color: var(--base-ink);
}
.base-choice:focus-visible {
  outline: none;
  box-shadow: var(--base-focus-ring);
}
.base-choice[data-state="checked"] {
  border-color: var(--base-accent);
  color: var(--base-ink);
  background: var(--base-accent-tint);
}
/* Forced colors flatten every border and fill, so the choice would
   vanish. A thick Highlight border marks it; the outline is focus's. */
@media (forced-colors: active) {
  .base-choice[data-state="checked"] {
    border: 3px solid Highlight;
  }
}
/* The disabled standard (tokens.css): authored, never opacity. */
.base-choice:disabled {
  color: var(--base-ink-disabled);
  background: var(--base-surface-sunken);
  border-color: var(--base-line);
  cursor: not-allowed;
}
</style>
