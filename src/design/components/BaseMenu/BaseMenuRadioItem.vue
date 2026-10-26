<template>
  <DropdownMenuRadioItem class="base-menu-item base-row" :value="value">
    <slot />
  </DropdownMenuRadioItem>
</template>

<script setup lang="ts">
/**
 * One choice in a BaseMenuRadioGroup, with BaseMenuItem's look (.base-row, from
 * rows.css). The checked state is aria-checked and
 * data-state="checked"; any visual mark for it is the caller's.
 */
import { DropdownMenuRadioItem } from "reka-ui";

defineProps<{
  value: string;
}>();
</script>
