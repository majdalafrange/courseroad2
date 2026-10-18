<template>
  <DropdownMenuRadioItem class="g-menu-item g-row" :value="value">
    <slot />
  </DropdownMenuRadioItem>
</template>

<script setup lang="ts">
/**
 * One choice in a GMenuRadioGroup, with GMenuItem's look (.g-row, from
 * rows.css). The checked state is aria-checked and
 * data-state="checked"; any visual mark for it is the caller's.
 */
import { DropdownMenuRadioItem } from "reka-ui";

defineProps<{
  value: string;
}>();
</script>
