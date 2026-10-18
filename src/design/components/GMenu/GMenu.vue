<template>
  <DropdownMenuRoot v-model:open="open" :modal="false">
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
import "../popover.css";
import "../rows.css";
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "reka-ui";

defineOptions({ inheritAttrs: false });

const { align = "start" } = defineProps<{
  align?: "start" | "end";
}>();

const open = defineModel<boolean>({ required: true });

function onEscapeKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented) {
    return;
  }
  event.preventDefault();
  open.value = false;
}
</script>

<style>
/* Not scoped: the content is teleported. The panel itself is
   .g-popover.menu, from popover.css, so menus and popovers share one
   surface. */
.g-menu {
  transform-origin: var(--reka-dropdown-menu-content-transform-origin);
}
/* Items are .g-row (rows.css); a destructive one takes the danger tint. */
.g-menu-item.danger[data-highlighted] {
  background: var(--g-danger-tint);
  color: var(--g-danger);
}
</style>
