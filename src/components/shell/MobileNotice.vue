<template>
  <div v-if="!dismissed" class="mobile-notice" role="status">
    <BaseIcon name="info" :size="14" class="notice-icon" />
    <span class="notice-text">
      CourseRoad works best on a laptop or desktop. Some features are hidden on
      small screens.
    </span>
    <BaseButton
      variant="ghost"
      size="xs"
      icon-only
      class="notice-dismiss"
      aria-label="Dismiss this notice"
      @click="dismiss"
    >
      <BaseIcon name="close" :size="12" />
    </BaseButton>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import BaseIcon from "../../design/components/BaseIcon.vue";
import BaseButton from "../../design/components/BaseButton.vue";
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
  background: var(--base-info-tint);
  color: var(--base-info);
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
/* Takes the notice's own color. Parent-prefixed to outrank BaseButton's
   ghost colors. */
.mobile-notice .notice-dismiss {
  flex-shrink: 0;
  color: inherit;
}
/* Touch tier: the button is 44px; it reaches into the bar's padding so
   the notice doesn't grow around it. */
@media (pointer: coarse) {
  .mobile-notice .notice-dismiss {
    margin: calc(-1 * var(--space-2)) calc(-1 * var(--space-3))
      calc(-1 * var(--space-2)) 0;
  }
}
.mobile-notice .notice-dismiss:hover:not(:disabled) {
  background: color-mix(in srgb, currentColor 18%, transparent);
  color: inherit;
}
</style>
