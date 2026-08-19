<template>
  <div class="fit-row" :class="{ 'is-complete': fit.complete }">
    <span class="row-rank" aria-hidden="true">{{ rank }}</span>

    <div class="row-main">
      <span class="row-title">
        {{ fit.title }}
        <span v-if="fit.onRoad" class="row-tag">on your road</span>
      </span>
      <span class="row-meta">
        <template v-if="fit.complete">complete</template>
        <template v-else>
          {{ fit.percent }}% complete<template
            v-if="fit.remaining !== undefined"
          >
            · {{ fit.progress }} of {{ fit.max }} done</template
          >
        </template>
      </span>
    </div>

    <g-progress
      class="row-gauge"
      fill-class="gauge-fill"
      :value="fit.percent ?? 0"
      :get-value-label="
        (v: number | null | undefined) => `${v}% of ${fit.title} satisfied`
      "
    />

    <div class="row-actions">
      <g-button size="sm" variant="ghost" @click="emit('preview')">
        What if?
      </g-button>
      <g-button
        :disabled="fit.onRoad"
        size="sm"
        variant="primary"
        @click="emit('add')"
      >
        Add
      </g-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import GButton from "../../design/components/GButton.vue";
import GProgress from "../../design/components/GProgress.vue";
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
  border-bottom: 1px solid var(--g-line);
}
.row-rank {
  font: var(--text-id-small);
  color: var(--g-ink-3);
  text-align: right;
}
.row-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.row-title {
  font: var(--text-body);
  color: var(--g-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-tag {
  font: var(--text-small);
  color: var(--g-ink-3);
  margin-left: var(--space-2);
}
.row-meta {
  font: var(--text-small);
  color: var(--g-ink-3);
}
.is-complete .row-meta {
  color: var(--g-ok);
}

/* Same encoding as the audit's program ring: green means progress. */
.row-gauge {
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--g-surface-sunken);
  overflow: hidden;
}
/* :deep(): GProgress's own indicator, a grandchild from here. */
:deep(.gauge-fill) {
  display: block;
  height: 100%;
  background: var(--g-ok);
}
.row-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
</style>
