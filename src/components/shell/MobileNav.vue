<template>
  <nav class="mobile-nav" aria-label="Sections">
    <button
      class="mobile-tab"
      :class="{ active: active === 'plan' }"
      :aria-current="active === 'plan' ? 'page' : undefined"
      @click="emit('navigate', 'plan')"
    >
      <BaseIcon name="map" :size="18" />
      <span>Plan</span>
    </button>
    <button
      class="mobile-tab"
      :class="{ active: active === 'progress' }"
      :aria-current="active === 'progress' ? 'page' : undefined"
      @click="emit('navigate', 'progress')"
    >
      <BaseIcon name="check" :size="18" />
      <span>Progress</span>
    </button>
    <button class="mobile-tab search-tab" @click="emit('search')">
      <BaseIcon name="plus" :size="18" />
      <span>Add<span class="sr-only"> classes</span></span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import BaseIcon from "../../design/components/BaseIcon.vue";

defineProps<{
  active: "plan" | "progress";
}>();

const emit = defineEmits<{
  (e: "navigate", view: "plan" | "progress"): void;
  (e: "search"): void;
}>();
</script>

<style scoped>
.mobile-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  background: var(--base-surface);
  border-top: 1px solid var(--base-line);
  /* A fixed height (border included), so what reserves room for the nav
     reserves exactly this much. */
  height: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.mobile-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-05);
  font: var(--text-small);
  color: var(--base-ink-3);
  background: transparent;
  border: none;
  justify-content: center;
  padding: 0;
  cursor: pointer;
}
/* Color alone can't carry the current tab: dark's silver accent sits
   1.3:1 from ink-3. The weight and the bar above the icon do. */
.mobile-tab {
  position: relative;
}
.mobile-tab.active {
  color: var(--base-accent);
  font-weight: 600;
}
.mobile-tab.active::before {
  content: "";
  position: absolute;
  top: -1px; /* over the nav's top border */
  left: 50%;
  width: 32px;
  height: 2px;
  transform: translateX(-50%);
  border-radius: 0 0 var(--radius-xs) var(--radius-xs);
  background: currentColor;
}
.mobile-tab:focus-visible {
  outline: none;
  box-shadow: var(--base-focus-ring-inset);
}
.search-tab {
  color: var(--base-ink-2);
}
</style>
