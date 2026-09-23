<template>
  <DropdownMenuLabel :as="as">
    <slot />
  </DropdownMenuLabel>
</template>

<script setup lang="ts">
/**
 * A caption inside a GMenu: not an item, so the arrow keys skip it.
 * Unstyled; the caller places it (a menu header row, say).
 */
import { DropdownMenuLabel } from "reka-ui";

const { as = "div" } = defineProps<{
  /** "span" when it sits inline in a row beside other content. */
  as?: "div" | "span";
}>();
</script>
