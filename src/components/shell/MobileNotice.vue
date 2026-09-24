<template>
  <div v-if="!dismissed" class="mobile-notice" role="status">
    <g-icon name="info" :size="14" class="notice-icon" />
    <span class="notice-text">
      CourseRoad works best on a laptop or desktop. Some features are hidden on
      small screens.
    </span>
    <g-button
      variant="ghost"
      size="xs"
      icon-only
      class="notice-dismiss"
      aria-label="Dismiss this notice"
      @click="dismiss"
    >
      <g-icon name="close" :size="12" />
    </g-button>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import GIcon from "../../design/components/GIcon.vue";
import GButton from "../../design/components/GButton.vue";
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
/* Takes the notice's own color. Parent-prefixed to outrank GButton's
   ghost colors. */
.mobile-notice .notice-dismiss {
  flex-shrink: 0;
  color: inherit;
}
.mobile-notice .notice-dismiss:hover:not(:disabled) {
  background: color-mix(in srgb, currentColor 18%, transparent);
  color: inherit;
}
</style>
