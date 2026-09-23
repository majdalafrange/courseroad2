<template>
  <ComboboxGroup>
    <ComboboxLabel :class="labelClass">
      <slot name="label" />
    </ComboboxLabel>
    <slot />
  </ComboboxGroup>
</template>

<script setup lang="ts">
/**
 * A labelled section of a GComboboxList (role="group", named by its
 * label through aria-labelledby, which Reka UI wires). The label slot is
 * the visible section heading; labelClass styles it.
 */
import { ComboboxGroup, ComboboxLabel } from "reka-ui";

const { labelClass = undefined } = defineProps<{
  labelClass?: string;
}>();
</script>
