<template>
  <DropdownMenuSeparator class="g-menu-separator" />
</template>

<script setup lang="ts">
/** A hairline between groups of items in a GMenu (role="separator"). */
import { DropdownMenuSeparator } from "reka-ui";
</script>

<style>
/* Not scoped: menu content is teleported (see GMenu.vue). */
.g-menu-separator {
  height: 1px;
  background: var(--g-line);
  margin: var(--space-1) var(--space-2);
}
</style>
