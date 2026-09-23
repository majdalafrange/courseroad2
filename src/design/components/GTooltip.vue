<template>
  <TooltipProvider :delay-duration="delay">
    <TooltipRoot v-model:open="open">
      <TooltipTrigger
        ref="trigger"
        as="span"
        class="g-tooltip-anchor"
        v-bind="$attrs"
        @focusin="onFocusin"
        @focusout="open = false"
      >
        <slot />
        <!-- Reka points aria-describedby at the content only while open, and
             from this wrapping span rather than the control inside it. This
             copy stays in the DOM (hidden elements still work as a
             description) and describes the wrapped control directly. -->
        <span :id="descriptionId" hidden>
          <slot name="content">{{ text }}</slot>
        </span>
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
 * Hover/focus delay, timing, and dismiss-on-scroll are Reka UI's
 * TooltipRoot; this is the visual skin. TooltipContent's Popper escapes
 * overflow:hidden ancestors.
 */
import { onMounted, onUpdated, ref, useId, useTemplateRef } from "vue";
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "reka-ui";

// TooltipProvider/TooltipRoot have no DOM node, so attrs passed to
// <g-tooltip> are forwarded to the trigger by hand.
defineOptions({ inheritAttrs: false });

const {
  text = "",
  placement = "bottom",
  delay = 350,
  wide = false,
} = defineProps<{
  text?: string;
  placement?: "top" | "bottom";
  /** ms before showing (default 350; tooltips must never feel eager). */
  delay?: number;
  /** Wrap to a fixed column instead of one nowrap line, for a sentence. */
  wide?: boolean;
}>();

// Reka's trigger listens for "focus", which does not bubble from the
// wrapped control; focusin does. Gated on :focus-visible because a click
// fires focusin too, and the tooltip would sit over the control's layer
// and eat its next outside click.
const open = ref(false);

function onFocusin(event: FocusEvent) {
  const target = event.target;
  if (target instanceof HTMLElement && target.matches(":focus-visible")) {
    open.value = true;
  }
}

/* The wrapped control is the caller's markup, so the description is
   attached by hand to the first focusable element inside the trigger.
   Skipped when the tooltip only repeats the control's own name. */
const descriptionId = `g-tooltip-desc-${useId()}`;
const triggerRef = useTemplateRef("trigger");
const FOCUSABLE = "button, a[href], input, select, textarea, [tabindex]";

function describeControl() {
  const root = triggerRef.value?.$el;
  if (!(root instanceof HTMLElement)) {
    return;
  }
  const control = root.querySelector<HTMLElement>(FOCUSABLE);
  if (control === null) {
    return;
  }
  const description = document.getElementById(descriptionId)?.textContent;
  const name = control.getAttribute("aria-label") ?? control.textContent;
  if (description?.trim() === name?.trim()) {
    control.removeAttribute("aria-describedby");
  } else {
    control.setAttribute("aria-describedby", descriptionId);
  }
}
onMounted(describeControl);
onUpdated(describeControl);
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
/* Scoped to the open states: Presence reads animation-name to decide
   whether to wait for an exit animation, so an always-on rule would
   delay the close. */
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
