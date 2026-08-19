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
 * Teleporting, viewport-collision positioning, and outside-click detection
 * are all Reka UI's Popper/DismissableLayer; this file adds the two bits
 * that are specific to how this app's layers cooperate:
 *  - a re-click on the anchor toggles through the caller's own handler
 *    (every #anchor slot already manages that), so it must not also count
 *    as an outside interaction and re-close what the click just opened.
 *  - Escape closes one layer, so it's marked consumed for window-level
 *    listeners (canvas, class detail) instead of also bubbling to them.
 */
import { ref } from "vue";
import {
  PopoverAnchor,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  type FocusOutsideEvent,
  type PointerDownOutsideEvent,
} from "reka-ui";

// PopoverRoot is context-only (no DOM node of its own), so a class or
// attrs passed to <g-popover> can't fall through to it automatically;
// forward $attrs to the anchor by hand instead, the element that
// actually sits in the caller's layout.
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    placement?: "top" | "bottom";
    align?: "start" | "end";
    /** Menu density: tight padding so rows own the edge. */
    menu?: boolean;
  }>(),
  { placement: "bottom", align: "start", menu: false },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const anchorEl = ref<InstanceType<typeof PopoverAnchor>>();

function toggle() {
  emit("update:modelValue", !props.modelValue);
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
/* Not scoped: PopoverContent is teleported out through several layers of
   Reka's own internal components before reaching a real DOM node, and
   Vue's scoped-CSS attribute doesn't reliably survive that chain (Reka's
   own styling guide calls this out for any teleported content). The g-*
   classes here are unique enough app-wide that a global rule is safe. */
.g-popover-anchor {
  display: inline-flex;
  min-width: 0;
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
/* Entry animation only, scoped to data-state (Reka's Presence reads
   computed animation-name to decide whether to wait for an exit
   animation before unmounting; an unconditional rule here would read as
   "still animating" on close and delay it a tick for no visual gain).
   Closing stays an instant unmount. */
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
