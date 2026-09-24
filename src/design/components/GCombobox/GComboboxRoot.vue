<template>
  <ComboboxRoot
    ref="root"
    :open="true"
    ignore-filter
    :reset-search-term-on-blur="false"
    :reset-search-term-on-select="false"
    @highlight="onHighlight"
  >
    <slot />
  </ComboboxRoot>
</template>

<script setup lang="ts">
/**
 * A search field with its result list always showing beneath it: the
 * command-palette shape of a combobox, not a dropdown. Reka UI's
 * Combobox supplies role="combobox" on the input, aria-activedescendant
 * tracking the highlighted option, the arrow/Home/End keys, Enter to
 * choose, hover-to-highlight, and scrolling the highlight into view.
 *
 * The caller owns the results: nothing is filtered here, and no value is
 * held, since choosing an item is an action (GComboboxItem's select), not
 * a selection that stays.
 *
 * Children: GComboboxInput, then GComboboxList holding GComboboxGroup and
 * GComboboxItem. Anything else the caller puts inside (filter chips, a
 * status line) counts as part of the combobox, so focusing or clicking
 * it does not dismiss the list.
 */
import { useTemplateRef } from "vue";
import { ComboboxRoot } from "reka-ui";
import { provideListId } from "./context";

provideListId();

const emit = defineEmits<{
  /** The highlighted item's value, or undefined when nothing is. */
  (e: "highlight", value: string | undefined): void;
}>();

function onHighlight(payload: { value: unknown } | undefined) {
  emit(
    "highlight",
    typeof payload?.value === "string" ? payload.value : undefined,
  );
}

const root = useTemplateRef<{ highlightFirstItem?: () => void }>("root");

defineExpose({
  /** Highlight the first item: after the results change underneath. */
  highlightFirst: () => root.value?.highlightFirstItem?.(),
});
</script>
