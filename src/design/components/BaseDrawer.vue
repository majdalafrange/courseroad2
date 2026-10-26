<template>
  <DrawerRoot v-model:open="open">
    <DrawerPortal>
      <DrawerOverlay class="base-drawer-scrim" />
      <DrawerContent
        class="base-drawer-panel"
        :aria-describedby="undefined"
        @escape-key-down="onEscapeKeyDown"
      >
        <DrawerHandle class="base-drawer-handle" />
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
 * the focus trap are Reka UI's Drawer. Escape closes one layer, as in
 * BaseSheet.
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
  /** Accessible dialog name. */
  label: string;
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
/* Not scoped: DrawerContent/DrawerOverlay are teleported (see BasePopover.vue). */
.base-drawer-scrim {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--base-scrim);
}
.base-drawer-scrim[data-state="open"] {
  animation: base-drawer-fade-in var(--motion-standard) var(--ease-out);
}
.base-drawer-scrim[data-state="closed"] {
  animation: base-drawer-fade-out var(--motion-quick) var(--ease-in);
}
@keyframes base-drawer-fade-in {
  from {
    opacity: 0;
  }
}
@keyframes base-drawer-fade-out {
  to {
    opacity: 0;
  }
}

.base-drawer-panel {
  position: fixed;
  inset: auto 0 0 0;
  width: 100%;
  height: calc(100dvh - 48px);
  display: flex;
  flex-direction: column;
  background: var(--base-surface);
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
.base-drawer-panel[data-swiping] {
  transition-duration: 0ms;
}
.base-drawer-panel[data-state="open"] {
  animation: base-drawer-slide-up var(--motion-standard) var(--ease-out);
}
.base-drawer-panel[data-state="closed"] {
  animation: base-drawer-slide-down var(--motion-quick) var(--ease-in);
}
@keyframes base-drawer-slide-up {
  from {
    translate: 0 100%;
  }
}
@keyframes base-drawer-slide-down {
  to {
    translate: 0 100%;
  }
}

.base-drawer-handle {
  flex-shrink: 0;
  width: 36px;
  height: 4px;
  margin: var(--space-2) auto;
  border-radius: var(--radius-full);
  background: var(--base-line-strong);
}
</style>
