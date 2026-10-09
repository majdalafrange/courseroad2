<template>
  <DropdownMenuRadioGroup
    :model-value="model"
    @update:model-value="(v) => (model = v as string)"
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

const model = defineModel<string>({ required: true });
</script>
