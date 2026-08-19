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
 * A completion bar: role="progressbar" and its aria-value* trio are Reka
 * UI's Progress, in place of each caller hand-writing the same three
 * attributes (and, a few times, skipping them entirely). Visuals stay
 * with the caller via the g-progress/fill-class classes; since the fill
 * is a grandchild from the caller's view, its rule needs :deep().
 */
import { computed } from "vue";
import { ProgressIndicator, ProgressRoot } from "reka-ui";

const props = withDefaults(
  defineProps<{
    value: number | null;
    max?: number;
    /** Extra class(es) for the fill only, e.g. a tone variant. */
    fillClass?: string | Record<string, boolean> | unknown[];
    /** Overrides the default "N%" accessible label. */
    getValueLabel?: (
      value: number | null | undefined,
      max: number,
    ) => string | undefined;
  }>(),
  { max: 100, fillClass: undefined, getValueLabel: undefined },
);

const percent = computed(() => {
  if (props.value === null) {
    return 0;
  }
  return Math.min(100, Math.max(0, (props.value / props.max) * 100));
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
