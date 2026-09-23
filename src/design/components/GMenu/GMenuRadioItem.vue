<template>
  <DropdownMenuRadioItem class="g-menu-item" :value="value">
    <slot />
  </DropdownMenuRadioItem>
</template>

<script setup lang="ts">
/**
 * One choice in a GMenuRadioGroup, with GMenuItem's look (the .g-menu-item
 * rules live in GMenu.vue). The checked state is aria-checked and
 * data-state="checked"; any visual mark for it is the caller's.
 */
import { DropdownMenuRadioItem } from "reka-ui";

defineProps<{
  value: string;
}>();
</script>
