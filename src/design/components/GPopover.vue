<template>
  <div ref="anchorEl" class="g-popover-anchor">
    <slot name="anchor" :toggle="toggle" :open="openPopover" :close="close" />
    <teleport to="body">
      <div
        v-if="modelValue"
        ref="popoverEl"
        class="g-popover"
        :class="[placement, align, { menu }]"
        :style="popStyle"
        role="dialog"
      >
        <slot :close="close" />
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

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

const anchorEl = ref<HTMLElement>();
const popoverEl = ref<HTMLElement>();
/** Hidden until measured, so the first frame never flashes at (0,0). */
const popStyle = ref<Record<string, string>>({ visibility: "hidden" });

function toggle() {
  emit("update:modelValue", !props.modelValue);
}
function openPopover() {
  emit("update:modelValue", true);
}
function close() {
  emit("update:modelValue", false);
}

/**
 * The popover is teleported to <body> and positioned in fixed coordinates
 * next to its anchor. This escapes the scrolling canvas (overflow: auto) and
 * the shell's overflow: hidden, which would otherwise clip it. We flip the
 * placement when there isn't room and clamp to the viewport so the content is
 * always fully visible.
 */
function position() {
  const anchor = anchorEl.value?.getBoundingClientRect();
  if (anchor === undefined) {
    return;
  }
  const pop = popoverEl.value?.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 8;
  const gap = 6;
  const popW = pop?.width ?? 220;
  const popH = pop?.height ?? 0;

  const below = anchor.bottom + gap;
  const above = anchor.top - gap - popH;
  let top: number;
  if (props.placement === "top") {
    top = above >= margin ? above : below;
  } else {
    top = below + popH <= vh - margin || above < margin ? below : above;
  }

  let left = props.align === "end" ? anchor.right - popW : anchor.left;

  left = Math.min(Math.max(left, margin), Math.max(margin, vw - margin - popW));
  top = Math.min(Math.max(top, margin), Math.max(margin, vh - margin - popH));

  popStyle.value = {
    position: "fixed",
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
  };
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as Node;
  if (
    props.modelValue &&
    !(anchorEl.value?.contains(target) ?? false) &&
    !(popoverEl.value?.contains(target) ?? false)
  ) {
    close();
  }
}

function onKeydown(event: KeyboardEvent) {
  if (props.modelValue && event.key === "Escape") {
    // Mark the Escape consumed so window-level listeners (canvas, class
    // detail) skip it; one keypress closes one layer. Document listeners
    // run before window listeners, so the mark is visible to them.
    event.preventDefault();
    close();
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      popStyle.value = { visibility: "hidden" };
      await nextTick();
      position();
      // Reposition while open so the popover stays glued to its anchor as the
      // canvas (or any ancestor) scrolls. Capture catches non-bubbling scroll.
      window.addEventListener("scroll", position, true);
      window.addEventListener("resize", position);
    } else {
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    }
  },
);

onMounted(() => {
  document.addEventListener("click", onDocumentClick, true);
  document.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", onDocumentClick, true);
  document.removeEventListener("keydown", onKeydown);
  window.removeEventListener("scroll", position, true);
  window.removeEventListener("resize", position);
});
</script>

<style scoped>
.g-popover-anchor {
  position: relative;
  display: inline-flex;
}
.g-popover {
  position: fixed;
  z-index: 50;
  min-width: 220px;
  background: var(--g-surface);
  border: 1px solid var(--g-overlay-line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-3);
  padding: var(--space-3);
  transform-origin: top left;
}
.g-popover.top {
  transform-origin: bottom left;
}
.g-popover.end {
  transform-origin: top right;
}
.g-popover.menu {
  padding: var(--space-1);
}
/* Self-contained entry animation (no Vue <transition>, so open/close never
   depend on a transition completing). Closing is an instant unmount. */
.g-popover {
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
