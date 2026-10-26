<template>
  <ToggleGroupRoot
    type="multiple"
    :orientation="orientation"
    :model-value="model"
    @update:model-value="(v) => (model = (v ?? []) as T[])"
  >
    <slot />
  </ToggleGroupRoot>
</template>

<script setup lang="ts" generic="T extends string">
/**
 * A set of BaseToggleGroupItems, any number pressed at once. One Tab stop
 * for the whole set, arrows between items (roving tabindex), role="group"
 * and each item's aria-pressed are Reka UI's ToggleGroup. Name the group
 * with an aria-label.
 */
import { ToggleGroupRoot } from "reka-ui";

const { orientation = "horizontal" } = defineProps<{
  /** Which arrow keys move between items. */
  orientation?: "horizontal" | "vertical";
}>();

/** The pressed items' values. */
const model = defineModel<T[]>({ required: true });
</script>
