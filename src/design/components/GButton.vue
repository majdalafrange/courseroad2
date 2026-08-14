<template>
  <button
    class="g-button"
    :class="[
      `v-${variant}`,
      `s-${size}`,
      { 'icon-only': iconOnly, 'is-loading': loading },
    ]"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    :type="type"
  >
    <span v-if="loading" class="g-spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "primary" | "subtle" | "ghost" | "danger";
    size?: "sm" | "md";
    disabled?: boolean;
    loading?: boolean;
    iconOnly?: boolean;
    type?: "button" | "submit";
  }>(),
  {
    variant: "subtle",
    size: "md",
    disabled: false,
    loading: false,
    iconOnly: false,
    type: "button",
  },
);
</script>

<style scoped>
.g-button {
  font: var(--text-body-strong);
  font-family: var(--font-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition:
    background-color var(--motion-quick) var(--ease-out),
    color var(--motion-quick) var(--ease-out),
    transform var(--motion-instant) var(--ease-out),
    box-shadow var(--motion-quick) var(--ease-out);
}
.g-button:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
.g-button:active:not(:disabled) {
  transform: translateY(0.5px) scale(0.99);
}
.g-button:disabled {
  cursor: default;
}
.g-button.is-loading {
  pointer-events: none;
}

/* loading spinner: currentColor so it inherits each variant's ink */
.g-spinner {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  border: 2px solid transparent;
  border-top-color: currentColor;
  animation: g-spin 800ms linear infinite;
}
@keyframes g-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .g-spinner {
    border-color: currentColor;
    animation: g-spinner-pulse 800ms ease-in-out infinite alternate;
  }
  @keyframes g-spinner-pulse {
    from {
      opacity: 1;
    }
    to {
      opacity: 0.4;
    }
  }
}

/* sizes */
.s-md {
  height: 34px;
  padding: 0 var(--space-4);
}
.s-sm {
  height: 28px;
  padding: 0 var(--space-3);
  font: var(--text-small);
  font-family: var(--font-text);
  font-weight: 600;
}
.icon-only.s-md {
  width: 34px;
  padding: 0;
}
.icon-only.s-sm {
  width: 28px;
  padding: 0;
}

/* variants */
.v-primary {
  background: var(--g-accent-fill);
  color: var(--g-on-accent);
}
.v-primary:hover:not(:disabled) {
  background: var(--g-accent-fill-hover);
}
.v-primary:active:not(:disabled) {
  background: var(--g-accent-fill-active);
}
.v-primary:disabled:not(.is-loading) {
  background: var(--g-surface-sunken);
  color: var(--g-ink-disabled);
  box-shadow: none;
}

.v-subtle {
  background: var(--g-surface);
  color: var(--g-ink);
  box-shadow: var(--shadow-1);
}
.v-subtle:hover:not(:disabled) {
  background: var(--g-surface-2);
  box-shadow: var(--shadow-2);
}
.v-subtle:active:not(:disabled) {
  background: var(--g-surface-sunken);
  box-shadow: var(--shadow-1);
}
.v-subtle:disabled:not(.is-loading) {
  background: var(--g-surface-sunken);
  color: var(--g-ink-disabled);
  box-shadow: inset 0 0 0 1px var(--g-line);
}

.v-ghost {
  background: transparent;
  color: var(--g-ink-2);
}
.v-ghost:hover:not(:disabled) {
  background: var(--g-accent-tint);
  color: var(--g-ink);
}
.v-ghost:active:not(:disabled) {
  background: var(--g-accent-tint-strong);
}
.v-ghost:disabled:not(.is-loading) {
  color: var(--g-ink-disabled);
}

.v-danger {
  background: transparent;
  color: var(--g-danger);
  box-shadow: inset 0 0 0 1px var(--g-line-strong);
}
.v-danger:hover:not(:disabled) {
  background: var(--g-danger-tint);
  box-shadow: inset 0 0 0 1px var(--g-danger);
}
.v-danger:disabled:not(.is-loading) {
  color: var(--g-ink-disabled);
  box-shadow: inset 0 0 0 1px var(--g-line);
}
</style>
