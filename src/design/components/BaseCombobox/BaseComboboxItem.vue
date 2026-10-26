<template>
  <ComboboxItem class="base-row is-ringed" :value="value" @select="onSelect">
    <slot />
  </ComboboxItem>
</template>

<script setup lang="ts">
/**
 * One option in a BaseComboboxList (role="option"). Highlighted, by arrow
 * key or by hover, it carries data-highlighted and becomes the input's
 * aria-activedescendant; style [data-highlighted], not a class of your
 * own; the row look is .base-row (rows.css), with the caller's layout on
 * top. Choosing it (Enter, or a click) emits "select". Nothing is kept
 * selected: choosing is the caller's action.
 *
 * Reka chooses on Enter by clicking the highlighted item, so the select
 * event alone cannot tell a key from a pointer; a caller that acts
 * differently on each tracks which came last itself.
 */
import "../rows.css";
import { ComboboxItem } from "reka-ui";

defineProps<{
  /** Unique, non-empty id of this item within the list. */
  value: string;
}>();

const emit = defineEmits<{
  (e: "select"): void;
}>();

function onSelect(event: Event) {
  // Nothing is held as the combobox value.
  event.preventDefault();
  emit("select");
}
</script>
