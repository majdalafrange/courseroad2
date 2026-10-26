<template>
  <div class="fit-row" :class="{ 'is-complete': fit.complete }">
    <span class="row-rank" aria-hidden="true">{{ rank }}</span>

    <div class="row-main">
      <span class="row-title">
        {{ fit.title }}
        <span v-if="fit.onRoad" class="row-tag">On your road</span>
      </span>
      <span class="row-meta">
        <template v-if="fit.complete">Complete</template>
        <template v-else>
          {{ fit.percent }}% complete<template
            v-if="fit.remaining !== undefined"
          >
            <span class="sep spaced">·</span>{{ fit.progress }} of
            {{ fit.max }} done</template
          >
        </template>
      </span>
    </div>

    <BaseProgress
      class="row-gauge"
      fill-class="gauge-fill"
      :value="fit.percent ?? 0"
      :get-value-label="
        (v: number | null | undefined) => `${v}% of ${fit.title} satisfied`
      "
    />

    <div class="row-actions">
      <BaseButton
        size="sm"
        variant="ghost"
        :aria-label="`What if: preview ${fit.title}`"
        @click="emit('preview')"
      >
        What if?
      </BaseButton>
      <BaseButton
        :disabled="fit.onRoad"
        size="sm"
        variant="primary"
        :aria-label="
          fit.onRoad ? `${fit.title} is on your road` : `Add ${fit.title}`
        "
        @click="emit('add')"
      >
        Add
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import BaseButton from "../../design/components/BaseButton.vue";
import BaseProgress from "../../design/components/BaseProgress.vue";
import type { ProgramFit } from "../../lib/degreeFit";

defineProps<{
  fit: ProgramFit;
  rank: number;
}>();

const emit = defineEmits<{
  (e: "preview"): void;
  (e: "add"): void;
}>();
</script>

<style scoped>
.fit-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 64px auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--base-line);
}
.row-rank {
  font: var(--text-id-small);
  color: var(--base-ink-3);
  text-align: right;
}
.row-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.row-title {
  font: var(--text-body);
  color: var(--base-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-tag {
  font: var(--text-small);
  color: var(--base-ink-3);
  margin-left: var(--space-2);
}
.row-meta {
  font: var(--text-small);
  color: var(--base-ink-3);
}
.is-complete .row-meta {
  color: var(--base-ok);
}

/* Same encoding as the audit's program ring: green means progress. */
.row-gauge {
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--base-surface-sunken);
  overflow: hidden;
}
/* :deep(): BaseProgress's own indicator, a grandchild from here. */
:deep(.gauge-fill) {
  display: block;
  height: 100%;
  background: var(--base-ok);
}
.row-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
</style>
