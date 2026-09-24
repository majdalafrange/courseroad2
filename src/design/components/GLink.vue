<template>
  <a
    class="g-link"
    :class="`t-${tone}`"
    :href="href"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener' : undefined"
    ><slot /><g-icon
      v-if="external && !hideExternalMark"
      name="external"
      :size="11"
      class="g-link-mark"
  /></a>
</template>

<script setup lang="ts">
/**
 * A text link. Two tones:
 * - "inline" (default): a link inside a sentence; accent and underlined,
 *   since color alone must not be what marks it (WCAG 1.4.1).
 * - "quiet": a standalone link in a list, footer or stat; it takes the
 *   color around it and shows accent and an underline on hover. The
 *   caller's container sets the color and font.
 *
 * external opens a new tab and appends GIcon's external mark, which
 * tells screen readers so. hideExternalMark drops the mark for a link
 * whose aria-label says it already. A link styled as a button is
 * GButton with an href.
 */
import GIcon from "./GIcon.vue";

const {
  href = undefined,
  tone = "inline",
  external = false,
  hideExternalMark = false,
} = defineProps<{
  /** Unset (an unsafe URL filtered out) leaves a plain anchor. */
  href?: string;
  tone?: "inline" | "quiet";
  external?: boolean;
  hideExternalMark?: boolean;
}>();
</script>

<style scoped>
.g-link {
  border-radius: var(--radius-xs);
  text-underline-offset: 2px;
  transition: color var(--motion-quick) var(--ease-out);
}
.g-link:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
.g-link-mark {
  margin-left: 3px;
}

.t-inline {
  color: var(--g-accent);
  text-decoration: underline;
}
.t-inline:hover {
  text-decoration-thickness: 2px;
}

.t-quiet {
  display: inline-flex;
  align-items: center;
  color: inherit;
  text-decoration: none;
}
.t-quiet:hover {
  color: var(--g-accent);
  text-decoration: underline;
}
</style>
