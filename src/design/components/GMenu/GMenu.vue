<template>
  <DropdownMenuRoot
    :open="modelValue"
    :modal="false"
    @update:open="emit('update:modelValue', $event)"
  >
    <DropdownMenuTrigger as-child>
      <slot name="trigger" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        class="g-popover menu g-menu"
        :align="align"
        :side-offset="6"
        :collision-padding="8"
        loop
        v-bind="$attrs"
        @escape-key-down="onEscapeKeyDown"
      >
        <slot />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<script setup lang="ts">
/**
 * An action menu: role="menu", arrow keys, typeahead, Home/End, focus
 * return to the trigger, and the trigger's aria-haspopup/aria-expanded
 * are Reka UI's DropdownMenu. The trigger slot's single element becomes
 * the trigger (as-child). Content is GMenuItem, GMenuRadioGroup with
 * GMenuRadioItem, GMenuLabel and GMenuSeparator. Attrs and listeners (e.g.
 * @close-auto-focus) go to the content. Not modal: a menu is a transient
 * list, not a dialog, and a modal one hides the page from assistive tech
 * (aria-hidden) while leaving it focusable. Arrow keys stay in the menu;
 * Tab, a click outside, or Escape closes it. Added here, as in GPopover:
 * Escape closes one layer and is marked consumed for window listeners.
 */
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "reka-ui";

defineOptions({ inheritAttrs: false });

const { align = "start" } = defineProps<{
  modelValue: boolean;
  align?: "start" | "end";
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

function onEscapeKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented) {
    return;
  }
  event.preventDefault();
  emit("update:modelValue", false);
}
</script>

<style>
/* Not scoped: the content is teleported (see GPopover.vue). The panel
   itself is .g-popover.menu, so menus and popovers share one surface. */
.g-menu {
  transform-origin: var(--reka-dropdown-menu-content-transform-origin);
}
.g-menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-body);
  color: var(--g-ink-2);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  text-decoration: none;
  user-select: none;
  outline: none;
  transition: background-color var(--motion-quick) var(--ease-out);
}
/* Reka moves real focus onto the highlighted item, by pointer and by
   arrow key alike; keyboard focus adds the inset ring so the tint alone
   never carries it. */
.g-menu-item[data-highlighted] {
  background: var(--g-accent-tint);
  color: var(--g-ink);
}
.g-menu-item:focus-visible {
  box-shadow: var(--g-focus-ring-inset);
}
.g-menu-item.danger[data-highlighted] {
  background: var(--g-danger-tint);
  color: var(--g-danger);
}
.g-menu-item[data-disabled] {
  color: var(--g-ink-disabled);
  cursor: default;
}
</style>
