<template>
  <div v-if="!dismissed" class="mobile-notice" role="status">
    <g-icon name="info" :size="14" class="notice-icon" />
    <span class="notice-text">
      CourseRoad is built for a bigger screen. For a better experience, please
      browse from a desktop computer.
    </span>
    <button class="notice-dismiss" aria-label="Dismiss" @click="dismiss">
      <g-icon name="close" :size="12" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import GIcon from "../../design/components/GIcon.vue";
import { STORAGE_KEYS, readValue, writeValue } from "../../lib/appStorage";

const dismissed = ref(
  readValue<boolean>(STORAGE_KEYS.dismissedMobileNotice) === true,
);

function dismiss() {
  dismissed.value = true;
  writeValue(STORAGE_KEYS.dismissedMobileNotice, true);
}
</script>

<style scoped>
.mobile-notice {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--g-info-tint);
  color: var(--g-info);
  font: var(--text-small);
  flex-shrink: 0;
}
.notice-icon {
  flex-shrink: 0;
}
.notice-text {
  flex: 1;
  min-width: 0;
}
.notice-dismiss {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.notice-dismiss:hover {
  background: color-mix(in srgb, currentColor 18%, transparent);
}
.notice-dismiss:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
</style>
