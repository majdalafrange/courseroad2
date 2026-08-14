<template>
  <span
    class="g-tooltip-anchor"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot />
    <transition name="g-tip">
      <span
        v-if="visible"
        class="g-tooltip"
        :class="[placement, { wide }]"
        role="tooltip"
      >
        <slot name="content">{{ text }}</slot>
      </span>
    </transition>
  </span>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";

const props = withDefaults(
  defineProps<{
    text?: string;
    placement?: "top" | "bottom";
    /** ms before showing (default 350; tooltips must never feel eager). */
    delay?: number;
    /** Wrap to a fixed column instead of one nowrap line, for a sentence. */
    wide?: boolean;
  }>(),
  { text: "", placement: "bottom", delay: 350, wide: false },
);

const visible = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

function show() {
  timer = setTimeout(() => {
    visible.value = true;
  }, props.delay);
}

function hide() {
  if (timer !== undefined) {
    clearTimeout(timer);
  }
  visible.value = false;
}

onBeforeUnmount(() => {
  if (timer !== undefined) {
    clearTimeout(timer);
  }
});
</script>

<style scoped>
.g-tooltip-anchor {
  position: relative;
  display: inline-flex;
}
.g-tooltip {
  font: var(--text-small);
  position: absolute;
  left: 50%;
  z-index: 60;
  transform: translateX(-50%);
  background: var(--g-ink);
  color: var(--g-bg);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-xs);
  white-space: nowrap;
  pointer-events: none;
  box-shadow: var(--shadow-2);
}
.g-tooltip.wide {
  width: 264px;
  white-space: normal;
  text-align: left;
  padding: var(--space-2);
  line-height: 1.45;
}
.g-tooltip.bottom {
  top: calc(100% + 6px);
}
.g-tooltip.top {
  bottom: calc(100% + 6px);
}
.g-tip-enter-active {
  transition:
    opacity var(--motion-quick) var(--ease-out),
    transform var(--motion-quick) var(--ease-out);
}
.g-tip-leave-active {
  transition: opacity var(--motion-instant) var(--ease-in);
}
.g-tip-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-2px);
}
.g-tip-leave-to {
  opacity: 0;
}
</style>
