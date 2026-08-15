<template>
  <div id="app-wrapper">
    <div v-if="fatalError" class="fatal-error" role="alert">
      <h1 class="fatal-title">Something went wrong</h1>
      <p class="fatal-copy">
        Sorry about that. Your roads are saved as you edit them, so nothing is
        lost, and reloading should get you back to normal.
      </p>
      <g-button variant="primary" @click="reload">Reload CourseRoad</g-button>
    </div>
    <template v-else>
      <router-view />
      <g-toast-host />
      <g-live-region />
    </template>
  </div>
</template>

<script setup lang="ts">
import GButton from "./design/components/GButton.vue";
import GLiveRegion from "./design/components/GLiveRegion.vue";
import GToastHost from "./design/components/GToastHost.vue";
import { fatalError } from "./lib/errorBoundary";

function reload() {
  window.location.reload();
}
</script>

<style scoped>
.fatal-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  height: 100vh;
  padding: var(--space-5);
  text-align: center;
  background: var(--g-bg);
  color: var(--g-ink);
}
.fatal-title {
  font: var(--text-display);
  letter-spacing: var(--tracking-tight);
  margin: 0;
}
.fatal-copy {
  font: var(--text-body);
  color: var(--g-ink-2);
  max-width: 420px;
  margin: 0;
}
</style>
