<template>
  <DropdownMenuSeparator class="base-menu-separator" />
</template>

<script setup lang="ts">
/** A hairline between groups of items in a BaseMenu (role="separator"). */
import { DropdownMenuSeparator } from "reka-ui";
</script>

<style>
/* Not scoped: menu content is teleported (see BaseMenu.vue). */
.base-menu-separator {
  height: 1px;
  background: var(--base-line);
  margin: var(--space-1) var(--space-2);
}
</style>
