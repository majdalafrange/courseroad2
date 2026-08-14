<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="seed-label">{{ seedLabel }}</span>
    </div>

    <div class="toolbar-center" role="group" aria-label="Edge filters">
      <button
        class="legend-item t-prereq"
        :class="{ off: store.hiddenTypes.has('prereq') }"
        :aria-pressed="!store.hiddenTypes.has('prereq')"
        :title="`${store.hiddenTypes.has('prereq') ? 'Show' : 'Hide'} prerequisite edges`"
        @click="store.toggleType('prereq')"
      >
        <span class="swatch" aria-hidden="true" />
        Prerequisite
      </button>
    </div>

    <div class="toolbar-right">
      <g-button size="sm" variant="ghost" @click="store.tidy()">
        Auto-arrange
      </g-button>
      <g-button
        size="sm"
        variant="ghost"
        data-cy="connectionsReseed"
        @click="store.reseedFromRoad()"
      >
        Re-seed from road
      </g-button>
      <g-button size="sm" @click="store.reset()">Reset</g-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import GButton from "../../design/components/GButton.vue";
import { useConnectionsStore } from "../../stores/connections";

const store = useConnectionsStore();

const seedLabel = computed(() => {
  const count = store.seed.subjectIds.length;
  if (store.seed.origin === "road") {
    return count === 0
      ? "No subjects yet"
      : `From your road · ${count} ${count === 1 ? "subject" : "subjects"}`;
  }
  if (store.seed.origin === "subject" || store.seed.origin === "manual") {
    return `From ${store.seed.subjectIds[0] ?? ""}`;
  }
  return "";
});
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--g-line);
  background: var(--g-surface);
  flex-wrap: wrap;
}
/* The surface is already named by the mode switch in the header, so the
   left slot states only what the graph was seeded from. */
.seed-label {
  font: var(--text-small);
  color: var(--g-ink-3);
}

.toolbar-center {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font: var(--text-small);
  color: var(--g-ink-2);
  background: transparent;
  /* outlined at rest: these are toggles, and a legend that only looks like a
     control on hover reads as a caption until someone clicks it */
  border: 1px solid var(--g-line-strong);
  border-radius: var(--radius-full);
  padding: 2px var(--space-2);
  cursor: pointer;
  transition:
    background-color var(--motion-quick) var(--ease-out),
    border-color var(--motion-quick) var(--ease-out),
    color var(--motion-quick) var(--ease-out);
}
.legend-item:hover {
  background: var(--g-surface-2);
}
.legend-item:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
/* switched off: recede the chip, but keep the outline so it still reads as
   something you can press again */
.legend-item.off {
  color: var(--g-ink-3);
  border-color: var(--g-line);
}
.legend-item.off .swatch {
  filter: grayscale(1);
  opacity: 0.55;
}
.swatch {
  width: 16px;
  height: 0;
  border-top-width: 2.5px;
  border-top-style: solid;
  border-color: var(--swatch-color, var(--g-ink-3));
}
.t-prereq {
  --swatch-color: var(--g-accent);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* One scrollable row on small screens; nothing hides, nothing wraps. */
@media (max-width: 859px) {
  .toolbar {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    gap: var(--space-3);
  }
  .toolbar::-webkit-scrollbar {
    display: none;
  }
  .seed-label {
    white-space: nowrap;
  }
  .toolbar-center {
    flex-wrap: nowrap;
  }
  .legend-item {
    white-space: nowrap;
  }
  .toolbar-right {
    flex-shrink: 0;
  }
}
</style>
