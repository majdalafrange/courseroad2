<template>
  <ComboboxContent
    position="inline"
    :aria-label="label"
    @escape-key-down="(event: KeyboardEvent) => emit('escape', event)"
  >
    <ComboboxViewport class="g-combobox-viewport">
      <slot />
    </ComboboxViewport>
  </ComboboxContent>
</template>

<script setup lang="ts">
/**
 * The result list of a GComboboxRoot (role="listbox"), laid out in place
 * under the input rather than floating. Attrs (a class) go to the list.
 *
 * Escape: the list is the top dismissable layer while it shows, so an
 * Escape anywhere reaches it before any dialog it sits in. It emits
 * "escape" with the event; a caller inside a dialog closes the dialog
 * there, and calls preventDefault to mark the keypress consumed for
 * window-level listeners.
 */
import { ComboboxContent, ComboboxViewport } from "reka-ui";

defineProps<{
  /** Accessible name of the list, e.g. "Results". */
  label: string;
}>();

const emit = defineEmits<{
  (e: "escape", event: KeyboardEvent): void;
}>();
</script>

<style>
/* Not scoped: Reka's viewport is a grandchild of the caller. It must be
   allowed to grow and scroll inside the caller's list. */
.g-combobox-viewport {
  flex: 1;
  min-height: 0;
}
</style>
