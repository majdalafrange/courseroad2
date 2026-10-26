<template>
  <PopoverRoot v-model:open="isOpen">
    <PopoverAnchor
      ref="anchorEl"
      as="div"
      class="base-popover-anchor"
      v-bind="$attrs"
    >
      <slot
        name="anchor"
        :toggle="toggle"
        :open="openPopover"
        :close="close"
        :trigger-props="triggerProps"
      />
    </PopoverAnchor>
    <PopoverPortal>
      <PopoverContent
        :id="contentId"
        class="base-popover"
        :class="[placement, align, { menu }]"
        :side="placement"
        :align="align"
        :side-offset="6"
        :collision-padding="8"
        role="dialog"
        :aria-label="label"
        @escape-key-down="onEscapeKeyDown"
        @interact-outside="onInteractOutside"
        @close-auto-focus="emit('closeAutoFocus', $event)"
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
import "./popover.css";
import { computed, useId, useTemplateRef } from "vue";
import {
  PopoverAnchor,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  type FocusOutsideEvent,
  type PointerDownOutsideEvent,
} from "reka-ui";

// PopoverRoot has no DOM node, so attrs passed to <BasePopover> are
// forwarded to the anchor by hand.
defineOptions({ inheritAttrs: false });

const {
  placement = "bottom",
  align = "start",
  menu = false,
} = defineProps<{
  /** Accessible name of the popover (it is a role="dialog"). */
  label: string;
  placement?: "top" | "bottom";
  align?: "start" | "end";
  /** Menu density: tight padding so rows own the edge. */
  menu?: boolean;
}>();

const isOpen = defineModel<boolean>({ required: true });

const emit = defineEmits<{
  /**
   * The popover closed and Reka is about to move focus (to nowhere in
   * particular: the anchor is not a trigger). preventDefault() and focus
   * something yourself to send it elsewhere.
   */
  (e: "closeAutoFocus", event: Event): void;
}>();
const anchorEl = useTemplateRef("anchorEl");

const contentId = `base-popover-${useId()}`;
/** Bind on an anchor that opens the popover; the anchor isn't a Reka
 *  trigger, so nothing sets these otherwise. */
const triggerProps = computed(() => ({
  "aria-haspopup": "dialog" as const,
  "aria-expanded": isOpen.value,
  "aria-controls": isOpen.value ? contentId : undefined,
}));

function toggle() {
  isOpen.value = !isOpen.value;
}
function openPopover() {
  isOpen.value = true;
}
function close() {
  isOpen.value = false;
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
/* Not scoped, like popover.css: the base-* classes are unique app-wide. */
.base-popover-anchor {
  display: inline-flex;
  flex-shrink: 0;
}
</style>
