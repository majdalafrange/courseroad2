<template>
  <ComboboxContent
    ref="content"
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
import { onMounted, useTemplateRef } from "vue";
import { ComboboxContent, ComboboxViewport } from "reka-ui";
import { injectListId } from "./context";

// Report the list's id to the input (see context.ts). Reka gives the list
// its id when it mounts; the listbox is the content's own element.
const listId = injectListId();
const content = useTemplateRef<{ $el: Element | null }>("content");
onMounted(() => {
  const el = content.value?.$el;
  const listbox =
    el instanceof Element
      ? (el.closest("[role=listbox]") ??
        el.querySelector("[role=listbox]") ??
        (el.getAttribute("role") === "listbox" ? el : null))
      : null;
  listId.value = listbox?.id || undefined;
});

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
/* The viewport is what scrolls. Reka injects a style hiding its scrollbar
   (made for dropdowns that scroll by arrow buttons); in a list that is
   always open that leaves no sign there is more below. The app's own thin
   scrollbar comes back here: the attribute selector outranks Reka's
   [data-reka-combobox-viewport] rule whichever loads last. */
.g-combobox-viewport[data-reka-combobox-viewport] {
  scrollbar-width: thin;
  scrollbar-color: var(--g-line-strong) transparent;
}
.g-combobox-viewport[data-reka-combobox-viewport]::-webkit-scrollbar {
  display: block;
  width: 8px;
}
</style>
