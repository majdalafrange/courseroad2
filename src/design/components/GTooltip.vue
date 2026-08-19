<template>
  <TooltipProvider :delay-duration="delay">
    <TooltipRoot>
      <TooltipTrigger as="span" class="g-tooltip-anchor" v-bind="$attrs">
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          class="g-tooltip"
          :class="{ wide }"
          :side="placement"
          :side-offset="6"
        >
          <slot name="content">{{ text }}</slot>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<script setup lang="ts">
/**
 * Hover/focus delay, show/hide timing, and dismiss-on-scroll are all Reka
 * UI's TooltipRoot; this file is just the visual skin (positioning comes
 * from TooltipContent's Popper, escaping overflow:hidden ancestors the old
 * absolute-positioned version could get clipped by).
 */
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "reka-ui";

// TooltipProvider/TooltipRoot are context-only (no DOM node of their
// own), so a class or attrs passed to <g-tooltip> can't fall through to
// them automatically; forward $attrs to the trigger by hand instead,
// the element that actually sits in the caller's layout.
defineOptions({ inheritAttrs: false });

withDefaults(
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
</script>

<style>
/* Not scoped: see GPopover.vue's note. TooltipContent is teleported
   through several layers of Reka's own components, and Vue's scoped-CSS
   attribute doesn't reliably survive that chain. */
.g-tooltip-anchor {
  display: inline-flex;
}
.g-tooltip {
  font: var(--text-small);
  z-index: 60;
  background: var(--g-ink);
  color: var(--g-bg);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-xs);
  white-space: nowrap;
  pointer-events: none;
  box-shadow: var(--shadow-2);
}
/* Scoped to the open states (not unconditional): Presence reads computed
   animation-name to decide whether to wait for an exit animation before
   unmounting, so an always-on rule would read as "still animating" and
   delay the close by a tick for no visual gain. */
.g-tooltip:not([data-state="closed"]) {
  animation: g-tip-in var(--motion-quick) var(--ease-out);
}
.g-tooltip.wide {
  width: 264px;
  white-space: normal;
  text-align: left;
  padding: var(--space-2);
  line-height: 1.45;
}
@keyframes g-tip-in {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
}
</style>
