<template>
  <div id="app-wrapper">
    <div v-if="fatalError" class="fatal-error" role="alert">
      <h1 class="fatal-title">CourseRoad hit an error</h1>
      <p class="fatal-copy">
        Your roads were saved as you edited them. Reload to pick up where you
        left off.
      </p>
      <BaseButton variant="primary" @click="reload">
        Reload CourseRoad
      </BaseButton>
    </div>
    <RouterView v-else />
  </div>
</template>

<script setup lang="ts">
import { watch } from "vue";

import BaseButton from "./design/components/BaseButton.vue";
import { useSystemThemeSync } from "./composables/useTheme";
import { fatalError } from "./lib/errorBoundary";
import { useReqListLoader, useSubjectsLoader } from "./loaders/courseData";

function reload() {
  window.location.reload();
}

/* ---- theme: keep the applied attribute in sync with "system" ---- */
useSystemThemeSync();

/* ---- catalog + requirements list: shared across every route, so the
   root kicks them off (Pinia Colada queries, see loaders/courseData.ts) ---- */
useSubjectsLoader();
const { error: reqListError } = useReqListLoader();
watch(reqListError, (e) => {
  if (e !== null) {
    console.warn("Failed to load the program list:", e);
  }
});
</script>

<style scoped>
.fatal-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  height: 100dvh;
  padding: var(--space-5);
  text-align: center;
  background: var(--base-bg);
  color: var(--base-ink);
}
.fatal-title {
  font: var(--text-display);
  letter-spacing: var(--tracking-tight);
  margin: 0;
}
.fatal-copy {
  font: var(--text-body);
  color: var(--base-ink-2);
  max-width: 420px;
  margin: 0;
}
</style>
