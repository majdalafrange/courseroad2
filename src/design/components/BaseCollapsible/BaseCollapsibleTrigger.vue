<template>
  <CollapsibleTrigger :as-child="asChild">
    <slot />
  </CollapsibleTrigger>
</template>

<script setup lang="ts">
/**
 * The button of a BaseCollapsibleRoot. A <button type="button"> of its own,
 * or with `asChild` its one child element (which must be a button)
 * takes the role instead. data-state="open" | "closed" for styling.
 */
import { CollapsibleTrigger } from "reka-ui";

const { asChild = false } = defineProps<{
  asChild?: boolean;
}>();
</script>
