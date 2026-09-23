<template>
  <DropdownMenuRadioGroup
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v as string)"
  >
    <slot />
  </DropdownMenuRadioGroup>
</template>

<script setup lang="ts">
/**
 * A single choice inside a GMenu: its GMenuRadioItems are announced as
 * checked or not (role="menuitemradio"). Choosing one emits the new value
 * and closes the menu.
 */
import { DropdownMenuRadioGroup } from "reka-ui";

defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();
</script>
