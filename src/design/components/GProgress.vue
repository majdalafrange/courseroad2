<template>
  <ProgressRoot
    class="g-progress"
    :model-value="value"
    :max="max"
    :get-value-label="getValueLabel"
  >
    <ProgressIndicator
      class="g-progress-fill"
      :class="fillClass"
      :style="{ width: `${percent}%` }"
    />
  </ProgressRoot>
</template>

<script setup lang="ts">
/**
 * A completion bar: role="progressbar" and the aria-value* trio are Reka
 * UI's Progress. Visuals stay with the caller; the fill is a grandchild,
 * so its rule needs :deep().
 */
import { computed } from "vue";
import { ProgressIndicator, ProgressRoot } from "reka-ui";

const {
  value,
  max = 100,
  fillClass = undefined,
  getValueLabel = undefined,
} = defineProps<{
  value: number | null;
  max?: number;
  /** Extra class(es) for the fill only, e.g. a tone variant. */
  fillClass?: string | Record<string, boolean> | unknown[];
  /** Overrides the default "N%" accessible label. */
  getValueLabel?: (
    value: number | null | undefined,
    max: number,
  ) => string | undefined;
}>();

const percent = computed(() => {
  if (value === null) {
    return 0;
  }
  return Math.min(100, Math.max(0, (value / max) * 100));
});
</script>

<style scoped>
.g-progress {
  display: block;
  overflow: hidden;
}
.g-progress-fill {
  display: block;
  height: 100%;
  transition: width var(--motion-quick) var(--ease-out);
}
</style>
