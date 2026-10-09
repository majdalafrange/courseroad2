<template>
  <ComboboxInput
    ref="input"
    :aria-controls="listId"
    :model-value="model"
    @update:model-value="(v) => (model = String(v ?? ''))"
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

const model = defineModel<string>({ required: true });

const input = useTemplateRef<{ $el: HTMLInputElement }>("input");

defineExpose({
  focus: () => input.value?.$el.focus(),
  select: () => input.value?.$el.select(),
  blur: () => input.value?.$el.blur(),
});
</script>
