<template>
  <g-sheet
    :model-value="modelValue"
    label="About"
    width="720px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="about-content">
      <about />
    </div>
  </g-sheet>
</template>

<script setup lang="ts">
import About from "./About.vue";
import GSheet from "../../design/components/GSheet.vue";

defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();
</script>

<style scoped>
.about-content {
  overflow-y: auto;
  padding: var(--space-6);
  font: var(--text-body);
  color: var(--g-ink);
}
</style>
