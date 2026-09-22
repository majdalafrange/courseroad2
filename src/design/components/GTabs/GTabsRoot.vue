<template>
  <TabsRoot
    class="g-tabs-root"
    :model-value="modelValue"
    :unmount-on-hide="unmountOnHide"
    @update:model-value="(v) => emit('update:modelValue', v as T)"
  >
    <slot />
  </TabsRoot>
</template>

<script setup lang="ts" generic="T extends string | number">
/**
 * A tab set: roving tabindex, arrow/Home/End keys, and the id/aria
 * wiring between GTabsTrigger and GTabsContent are Reka UI's Tabs.
 */
import { TabsRoot } from "reka-ui";

const { modelValue = undefined, unmountOnHide = true } = defineProps<{
  modelValue?: T;
  /** false keeps every panel mounted (just hidden), not only the
   *  active one; the caller's own state per panel then survives a
   *  tab switch instead of resetting. */
  unmountOnHide?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: T): void;
}>();
</script>
