<template>
  <ToggleGroupItem :value="value" :as-child="asChild">
    <slot />
  </ToggleGroupItem>
</template>

<script setup lang="ts" generic="T extends string">
/**
 * A caller's scoped class can't reach the item's own <button>, so style
 * through `asChild` (a BaseButton or your own <button>).
 */
import { ToggleGroupItem } from "reka-ui";

const { asChild = false } = defineProps<{
  value: T;
  asChild?: boolean;
}>();
</script>
