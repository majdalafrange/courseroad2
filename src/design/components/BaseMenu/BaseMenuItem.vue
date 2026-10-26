<template>
  <DropdownMenuItem
    class="base-menu-item base-row"
    :class="{ danger }"
    :disabled="disabled"
    :as-child="asChild"
    @select="emit('select', $event)"
  >
    <slot />
  </DropdownMenuItem>
</template>

<script setup lang="ts">
/**
 * One action in a BaseMenu. Selecting (click, Enter, Space) closes the menu
 * unless the handler calls event.preventDefault(). as-child renders the
 * slot's element as the item, for a link: <BaseMenuItem as-child><a ...>.
 */
import { DropdownMenuItem } from "reka-ui";

const {
  danger = false,
  disabled = false,
  asChild = false,
} = defineProps<{
  danger?: boolean;
  disabled?: boolean;
  asChild?: boolean;
}>();

const emit = defineEmits<{
  (e: "select", event: Event): void;
}>();
</script>
