<template>
  <Toggle
    as-child
    :model-value="model"
    @update:model-value="(v) => (model = v)"
  >
    <slot />
  </Toggle>
</template>

<script setup lang="ts">
/**
 * Makes its one child (a BaseButton) a toggle button: aria-pressed and
 * data-state="on" | "off" are Reka UI's Toggle, and a click flips the
 * model.
 */
import { Toggle } from "reka-ui";

const model = defineModel<boolean>({ required: true });
</script>
