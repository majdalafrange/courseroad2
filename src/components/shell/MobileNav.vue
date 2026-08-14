<template>
  <nav class="mobile-nav" aria-label="Sections">
    <button
      class="mobile-tab"
      :class="{ active: active === 'plan' }"
      @click="emit('navigate', 'plan')"
    >
      <g-icon name="map" :size="18" />
      <span>Plan</span>
    </button>
    <button
      class="mobile-tab"
      :class="{ active: active === 'progress' }"
      @click="emit('navigate', 'progress')"
    >
      <g-icon name="check" :size="18" />
      <span>Progress</span>
    </button>
    <button class="mobile-tab search-tab" @click="emit('search')">
      <g-icon name="search" :size="18" />
      <span>Find</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import GIcon from "../../design/components/GIcon.vue";

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
  background: var(--g-surface);
  border-top: 1px solid var(--g-line);
  padding-bottom: env(safe-area-inset-bottom, 0);
}
.mobile-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font: var(--text-small);
  color: var(--g-ink-3);
  background: transparent;
  border: none;
  padding: var(--space-2) 0;
  cursor: pointer;
}
.mobile-tab.active {
  color: var(--g-accent);
}
.search-tab {
  color: var(--g-ink-2);
}
</style>
