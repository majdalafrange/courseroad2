<template>
  <ComboboxInput
    ref="input"
    :aria-controls="listId"
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', String(v ?? ''))"
  />
</template>

<script setup lang="ts">
/**
 * The text field of a GComboboxRoot (role="combobox", aria-expanded,
 * aria-controls and aria-activedescendant are Reka UI's). Unstyled:
 * attrs (class, placeholder, aria-label, listeners) go to the <input>.
 * Reka handles the arrow keys, Home, End and Enter here; a caller's
 * keydown listener runs after them and gets every other key.
 */
import { useTemplateRef } from "vue";
import { ComboboxInput } from "reka-ui";
import { injectListId } from "./context";

const listId = injectListId();

defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const input = useTemplateRef<{ $el: HTMLInputElement }>("input");

defineExpose({
  focus: () => input.value?.$el.focus(),
  select: () => input.value?.$el.select(),
  blur: () => input.value?.$el.blur(),
});
</script>
