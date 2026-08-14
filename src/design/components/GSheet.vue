<template>
  <teleport to="body">
    <transition name="g-sheet">
      <div
        v-if="modelValue"
        class="g-sheet-scrim"
        :class="{ opaque: scrim === 'opaque' }"
        @click.self="close"
      >
        <div
          ref="sheetEl"
          class="g-sheet-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="label"
          tabindex="-1"
          :style="{ width }"
          v-bind="$attrs"
        >
          <button
            v-if="closeButton && dismissible"
            class="g-sheet-close"
            aria-label="Close"
            @click="close"
          >
            <g-icon name="close" :size="16" />
          </button>
          <slot />
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
/*
 * The modal sheet primitive: scrim, panel, and the keyboard contract
 * every modal owes. Escape closes one layer (marked consumed via
 * preventDefault, the same convention as GPopover), Tab stays inside,
 * and focus returns to the opener on close. Dialogs that need their own
 * chrome pass :close-button="false" and keep the rest.
 */
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import GIcon from "./GIcon.vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    /** Accessible dialog name (aria-label). */
    label: string;
    /** Panel width; the panel never exceeds the viewport. */
    width?: string;
    closeButton?: boolean;
    /**
     * false for forced-choice dialogs (sync-conflict resolution): Escape
     * and scrim clicks do nothing, and no close button renders. The trap
     * and focus restore still apply.
     */
    dismissible?: boolean;
    /** "opaque" for full takeovers (first-run onboarding). */
    scrim?: "default" | "opaque";
  }>(),
  { width: "560px", closeButton: true, dismissible: true, scrim: "default" },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const sheetEl = ref<HTMLElement | null>(null);
let opener: HTMLElement | null = null;

function close() {
  if (props.dismissible) {
    emit("update:modelValue", false);
  }
}

function onKeydown(event: KeyboardEvent) {
  if (!props.modelValue) {
    return;
  }
  if (event.key === "Escape" && !event.defaultPrevented && props.dismissible) {
    // One Escape closes one layer: mark it consumed so window-level
    // listeners (canvas, class detail) skip this keypress.
    event.preventDefault();
    close();
    return;
  }
  if (event.key === "Tab") {
    trapTab(event);
  }
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapTab(event: KeyboardEvent) {
  const panel = sheetEl.value;
  if (panel === null) {
    return;
  }
  const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (focusables.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  const inside = panel.contains(active);
  if (event.shiftKey && (!inside || active === first || active === panel)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (!inside || active === last)) {
    event.preventDefault();
    first.focus();
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      opener =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      document.addEventListener("keydown", onKeydown);
      await nextTick();
      sheetEl.value?.focus();
    } else {
      document.removeEventListener("keydown", onKeydown);
      opener?.focus();
      opener = null;
    }
  },
  // immediate: a sheet can be mounted already open (e.g. v-if hosts).
  { immediate: true },
);

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
});
</script>

<style scoped>
.g-sheet-scrim {
  position: fixed;
  inset: 0;
  background: var(--g-scrim);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.g-sheet-scrim.opaque {
  background: var(--g-bg);
}
.g-sheet-panel {
  position: relative;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 64px);
  background: var(--g-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-3);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  outline: none;
}
.g-sheet-close {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--g-surface);
  color: var(--g-ink-3);
  cursor: pointer;
  z-index: 1;
  box-shadow: var(--shadow-1);
}
.g-sheet-close:hover {
  color: var(--g-ink);
}

.g-sheet-enter-active {
  transition: opacity var(--motion-standard) var(--ease-out);
}
.g-sheet-leave-active {
  transition: opacity var(--motion-quick) var(--ease-in);
}
.g-sheet-enter-from,
.g-sheet-leave-to {
  opacity: 0;
}
</style>
