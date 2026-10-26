<template>
  <a
    v-if="href"
    class="base-button"
    :class="classes"
    :href="href"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener' : undefined"
  >
    <slot />
  </a>
  <button
    v-else
    class="base-button"
    :class="classes"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    :type="type"
  >
    <span v-if="loading" class="base-spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";

const {
  variant = "subtle",
  size = "md",
  disabled = false,
  loading = false,
  iconOnly = false,
  type = "button",
  href = undefined,
  external = false,
} = defineProps<{
  /** "link" and "quiet" read as text, sized by it rather than a box:
   *  "link" is an accent action ("Go to it"); "quiet" is a secondary
   *  one that should recede ("Retry", "More links"), muted and
   *  underlined like BaseLink's quiet tone. "field" is shaped like a
   *  text field (the header's road switcher and class search): a
   *  button that stands in for one, or names what its menu holds. */
  variant?:
    "primary" | "subtle" | "ghost" | "danger" | "link" | "quiet" | "field";
  /** "xs" is the 24px minimum target (WCAG 2.5.8): a small control
   *  inside a row or header, usually icon-only. */
  size?: "xs" | "sm" | "md";
  disabled?: boolean;
  loading?: boolean;
  iconOnly?: boolean;
  type?: "button" | "submit";
  /** Render as a link to this URL. */
  href?: string;
  /** With href: open in a new tab. The caller says so in the name, via
   *  BaseIcon's "external" mark or the aria-label. */
  external?: boolean;
}>();

const classes = computed(() => [
  `v-${variant}`,
  `s-${size}`,
  { "icon-only": iconOnly, "is-loading": loading },
]);
</script>

<style scoped>
.base-button {
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
  text-decoration: none;
  transition:
    background-color var(--motion-quick) var(--ease-out),
    color var(--motion-quick) var(--ease-out),
    transform var(--motion-instant) var(--ease-out),
    box-shadow var(--motion-quick) var(--ease-out);
}
.base-button:focus-visible {
  outline: none;
  box-shadow: var(--base-focus-ring);
}
.base-button:active:not(:disabled) {
  transform: translateY(0.5px) scale(0.99);
}
.base-button:disabled {
  cursor: default;
}
.base-button.is-loading {
  pointer-events: none;
}

/* loading spinner: currentColor so it inherits each variant's ink */
.base-spinner {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  border: 2px solid transparent;
  border-top-color: currentColor;
  animation: base-spin 800ms linear infinite;
}
@keyframes base-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .base-spinner {
    border-color: currentColor;
    animation: base-spinner-pulse 800ms ease-in-out infinite alternate;
  }
  @keyframes base-spinner-pulse {
    from {
      opacity: 1;
    }
    to {
      opacity: 0.4;
    }
  }
}

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
.s-xs {
  height: 24px;
  padding: 0 var(--space-2);
  font: var(--text-small);
  font-family: var(--font-text);
  font-weight: 600;
  border-radius: var(--radius-xs);
}
.icon-only.s-md {
  width: 34px;
  padding: 0;
}
.icon-only.s-sm {
  width: 28px;
  padding: 0;
}
.icon-only.s-xs {
  width: 24px;
  padding: 0;
}

/* Phone with a touch pointer: every size is a 44px target (tokens.css,
   TOUCH TIER). A mouse in a narrow window keeps the compact sizes. */
@media (max-width: 859px) and (pointer: coarse) {
  .s-md,
  .s-sm,
  .s-xs {
    height: 44px;
  }
  .icon-only.s-md,
  .icon-only.s-sm,
  .icon-only.s-xs {
    width: 44px;
  }
}

.v-primary {
  background: var(--base-accent-fill);
  color: var(--base-on-accent);
}
.v-primary:hover:not(:disabled) {
  background: var(--base-accent-fill-hover);
}
.v-primary:active:not(:disabled) {
  background: var(--base-accent-fill-active);
}
.v-primary:disabled:not(.is-loading) {
  background: var(--base-surface-sunken);
  color: var(--base-ink-disabled);
  box-shadow: none;
}

/* The Inputs rest ring (tokens.css): a shadow alone left no visible edge. */
.v-subtle {
  background: var(--base-surface);
  color: var(--base-ink);
  box-shadow: inset 0 0 0 1px var(--base-line-control);
}
.v-subtle:hover:not(:disabled) {
  background: var(--base-surface-2);
  box-shadow: inset 0 0 0 1px var(--base-ink-3);
}
.v-subtle:active:not(:disabled) {
  background: var(--base-surface-sunken);
  box-shadow: inset 0 0 0 1px var(--base-ink-3);
}
/* Matches the hover rule's weight, so focus keeps its ring under the
   pointer too. */
.v-subtle:focus-visible:not(:disabled) {
  box-shadow:
    inset 0 0 0 1px var(--base-line-control),
    var(--base-focus-ring);
}
.v-subtle:disabled:not(.is-loading) {
  background: var(--base-surface-sunken);
  color: var(--base-ink-disabled);
  box-shadow: inset 0 0 0 1px var(--base-line);
}

/* After the sizes, whose padding it narrows to a field's. The Inputs rest
   and hover rings with the Buttons focus ring (tokens.css); an open menu
   keeps the hover ring, so the button reads as the menu's owner. A field
   doesn't press in. */
.v-field {
  justify-content: flex-start;
  padding: 0 var(--space-3);
  font: var(--text-body);
  font-family: var(--font-text);
  background: var(--base-surface);
  color: var(--base-ink);
  box-shadow: inset 0 0 0 1px var(--base-line-control);
}
.v-field:hover:not(:disabled),
.v-field[aria-expanded="true"] {
  box-shadow: inset 0 0 0 1px var(--base-ink-3);
}
.v-field:focus-visible {
  box-shadow: var(--base-focus-ring);
}
.v-field:active:not(:disabled) {
  transform: none;
}
.v-field:disabled:not(.is-loading) {
  background: var(--base-surface-sunken);
  color: var(--base-ink-disabled);
  box-shadow: inset 0 0 0 1px var(--base-line);
}

.v-ghost {
  background: transparent;
  color: var(--base-ink-2);
}
.v-ghost:hover:not(:disabled) {
  background: var(--base-accent-tint);
  color: var(--base-ink);
}
.v-ghost:active:not(:disabled) {
  background: var(--base-accent-tint-strong);
}
.v-ghost:disabled:not(.is-loading) {
  color: var(--base-ink-disabled);
}

.v-danger {
  background: transparent;
  color: var(--base-danger);
  box-shadow: inset 0 0 0 1px var(--base-line-strong);
}
.v-danger:hover:not(:disabled) {
  background: var(--base-danger-tint);
  box-shadow: inset 0 0 0 1px var(--base-danger);
}
.v-danger:disabled:not(.is-loading) {
  color: var(--base-ink-disabled);
  box-shadow: inset 0 0 0 1px var(--base-line);
}

/* After the sizes: a link is sized by its text, whatever the size (the
   size still sets the font), but never under the 24px target (WCAG
   2.5.8) when it stands alone. */
.v-link,
.v-quiet {
  height: auto;
  min-height: 24px;
  padding: 0;
  background: transparent;
  border-radius: var(--radius-xs);
  text-underline-offset: 2px;
}
@media (max-width: 859px) and (pointer: coarse) {
  .v-link,
  .v-quiet {
    min-height: 44px;
  }
}
/* BaseLink's inline tone: ink and underlined at rest, so cardinal stays for
   the current-term flag and the primary action. */
.v-link {
  color: var(--base-ink);
  text-decoration: underline;
  text-decoration-color: var(--base-ink-3);
  transition: color var(--motion-quick) var(--ease-out);
}
.v-link:hover:not(:disabled) {
  color: var(--base-accent);
  text-decoration-color: currentColor;
  text-decoration-thickness: 2px;
}
.v-link:active:not(:disabled) {
  transform: none;
}
.v-link:disabled:not(.is-loading) {
  color: var(--base-ink-disabled);
}

/* Muted, so the underline is what says it can be pressed. */
.v-quiet {
  color: var(--base-ink-2);
  font-weight: 400;
  text-decoration: underline;
  text-decoration-color: var(--base-line-strong);
  transition: color var(--motion-quick) var(--ease-out);
}
.v-quiet:hover:not(:disabled) {
  color: var(--base-accent);
  text-decoration-color: currentColor;
}
.v-quiet:active:not(:disabled) {
  transform: none;
}
.v-quiet:disabled:not(.is-loading) {
  color: var(--base-ink-disabled);
}
</style>
