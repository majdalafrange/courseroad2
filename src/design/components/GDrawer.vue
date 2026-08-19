<template>
  <DrawerRoot :open="modelValue" @update:open="onUpdateOpen">
    <DrawerPortal>
      <DrawerOverlay class="g-drawer-scrim" />
      <DrawerContent
        class="g-drawer-panel"
        :aria-describedby="undefined"
        @escape-key-down="onEscapeKeyDown"
      >
        <DrawerHandle class="g-drawer-handle" />
        <VisuallyHidden as-child>
          <DrawerTitle>{{ label }}</DrawerTitle>
        </VisuallyHidden>
        <slot />
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>

<script setup lang="ts">
/*
 * A bottom sheet (mobile panels): swipe-to-dismiss, the drag handle, and
 * the same focus trap/return-focus/keyboard contract as GSheet are Reka
 * UI's Drawer, a purpose-built sibling of Dialog for a panel anchored to
 * an edge instead of floating centered. Escape closes one layer, same
 * convention as GSheet.
 */
import {
  DrawerContent,
  DrawerHandle,
  DrawerOverlay,
  DrawerPortal,
  DrawerRoot,
  DrawerTitle,
  VisuallyHidden,
} from "reka-ui";

defineProps<{
  modelValue: boolean;
  /** Accessible dialog name. */
  label: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

function onUpdateOpen(open: boolean) {
  emit("update:modelValue", open);
}

function onEscapeKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented) {
    return;
  }
  event.preventDefault();
  emit("update:modelValue", false);
}
</script>

<style>
/* Not scoped: see GPopover.vue's note. DrawerContent/DrawerOverlay are
   teleported through several layers of Reka's own components, and Vue's
   scoped-CSS attribute doesn't reliably survive that chain. */
.g-drawer-scrim {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--g-scrim);
}
.g-drawer-scrim[data-state="open"] {
  animation: g-drawer-fade-in var(--motion-standard) var(--ease-out);
}
.g-drawer-scrim[data-state="closed"] {
  animation: g-drawer-fade-out var(--motion-quick) var(--ease-in);
}
@keyframes g-drawer-fade-in {
  from {
    opacity: 0;
  }
}
@keyframes g-drawer-fade-out {
  to {
    opacity: 0;
  }
}

.g-drawer-panel {
  position: fixed;
  inset: auto 0 0 0;
  width: 100%;
  height: calc(100dvh - 48px);
  display: flex;
  flex-direction: column;
  background: var(--g-surface);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-3);
  overflow: hidden;
  outline: none;
  z-index: 100;
  transform: translateY(var(--drawer-swipe-movement-y, 0px));
  transition: transform var(--motion-standard) var(--ease-out);
}
/* Follow the finger with no lag while actively dragging; the transition
   above only applies once the drag lets go. */
.g-drawer-panel[data-swiping] {
  transition-duration: 0ms;
}
.g-drawer-panel[data-state="open"] {
  animation: g-drawer-slide-up var(--motion-standard) var(--ease-out);
}
.g-drawer-panel[data-state="closed"] {
  animation: g-drawer-slide-down var(--motion-quick) var(--ease-in);
}
@keyframes g-drawer-slide-up {
  from {
    translate: 0 100%;
  }
}
@keyframes g-drawer-slide-down {
  to {
    translate: 0 100%;
  }
}

.g-drawer-handle {
  flex-shrink: 0;
  width: 36px;
  height: 4px;
  margin: var(--space-2) auto;
  border-radius: var(--radius-full);
  background: var(--g-line-strong);
}
</style>
