<template>
  <PopoverRoot
    :open="modelValue"
    @update:open="emit('update:modelValue', $event)"
  >
    <PopoverAnchor
      ref="anchorEl"
      as="div"
      class="g-popover-anchor"
      v-bind="$attrs"
    >
      <slot name="anchor" :toggle="toggle" :open="openPopover" :close="close" />
    </PopoverAnchor>
    <PopoverPortal>
      <PopoverContent
        class="g-popover"
        :class="[placement, align, { menu }]"
        :side="placement"
        :align="align"
        :side-offset="6"
        :collision-padding="8"
        role="dialog"
        :aria-label="label"
        @escape-key-down="onEscapeKeyDown"
        @interact-outside="onInteractOutside"
      >
        <slot :close="close" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup lang="ts">
/**
 * Teleporting, collision positioning, and outside-click detection are
 * Reka UI's Popper/DismissableLayer. Added here: a re-click on the anchor
 * toggles through the caller's own handler and must not also count as an
 * outside interaction; Escape closes one layer and is marked consumed for
 * window-level listeners.
 */
import { useTemplateRef } from "vue";
import {
  PopoverAnchor,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  type FocusOutsideEvent,
  type PointerDownOutsideEvent,
} from "reka-ui";

// PopoverRoot has no DOM node, so attrs passed to <g-popover> are
// forwarded to the anchor by hand.
defineOptions({ inheritAttrs: false });

const {
  modelValue,
  placement = "bottom",
  align = "start",
  menu = false,
} = defineProps<{
  modelValue: boolean;
  /** Accessible name of the popover (it is a role="dialog"). */
  label: string;
  placement?: "top" | "bottom";
  align?: "start" | "end";
  /** Menu density: tight padding so rows own the edge. */
  menu?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();
const anchorEl = useTemplateRef("anchorEl");

function toggle() {
  emit("update:modelValue", !modelValue);
}
function openPopover() {
  emit("update:modelValue", true);
}
function close() {
  emit("update:modelValue", false);
}

function onEscapeKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented) {
    // Already consumed by an inner layer; one Escape closes one layer.
    return;
  }
  event.preventDefault();
  close();
}

function onInteractOutside(event: PointerDownOutsideEvent | FocusOutsideEvent) {
  const anchor = anchorEl.value?.$el as HTMLElement | undefined;
  if (anchor?.contains(event.target as Node | null)) {
    event.preventDefault();
  }
}
</script>

<style>
/* Not scoped: PopoverContent is teleported through several layers of
   Reka's components and Vue's scoped-CSS attribute does not survive
   that. The g-* classes are unique app-wide. */
.g-popover-anchor {
  display: inline-flex;
  flex-shrink: 0;
}
.g-popover {
  z-index: 50;
  min-width: 220px;
  background: var(--g-surface);
  border: 1px solid var(--g-overlay-line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-3);
  padding: var(--space-3);
  transform-origin: var(--reka-popover-content-transform-origin);
}
.g-popover.menu {
  padding: var(--space-1);
}
/* Entry animation only, scoped to data-state: Reka's Presence reads
   animation-name to decide whether to wait for an exit animation, so an
   unconditional rule would delay the close. */
.g-popover[data-state="open"] {
  animation: g-pop-in var(--motion-quick) var(--ease-out);
}
@keyframes g-pop-in {
  from {
    transform: scale(0.97) translateY(-3px);
  }
  to {
    transform: none;
  }
}
</style>
