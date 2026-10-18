<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="seed-label"
        ><template v-for="(part, i) in seedParts" :key="part"
          ><span v-if="i > 0" class="sep spaced">·</span>{{ part }}</template
        ></span
      >
    </div>

    <g-toggle-group-root
      class="toolbar-center"
      aria-label="Edge filters"
      :model-value="shownLayers"
      @update:model-value="setShownLayers"
    >
      <g-toggle-group-item value="prereq" as-child>
        <g-button
          size="sm"
          variant="ghost"
          class="legend-item t-prereq"
          :title="`${store.hiddenTypes.has('prereq') ? 'Show' : 'Hide'} prerequisite edges`"
        >
          <span class="swatch" aria-hidden="true" />
          <span class="legend-text">Prerequisite</span>
        </g-button>
      </g-toggle-group-item>
      <g-toggle-group-item value="labels" as-child>
        <g-button
          size="sm"
          variant="ghost"
          class="legend-item"
          :title="`${store.showRowLabels ? 'Hide' : 'Show'} row labels`"
        >
          <span class="legend-text">Labels</span>
        </g-button>
      </g-toggle-group-item>
    </g-toggle-group-root>

    <div class="toolbar-right">
      <g-button size="sm" variant="ghost" @click="store.tidy()">
        Arrange view
      </g-button>
      <!-- One keeps the starting subjects, the other replaces them; the
           names say which. -->
      <g-button size="sm" variant="ghost" @click="store.reset()">
        Remove unpinned classes
      </g-button>
      <g-button
        size="sm"
        variant="ghost"
        data-cy="connectionsReseed"
        @click="store.reseedFromRoad()"
      >
        Full Reset
      </g-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  GToggleGroupItem,
  GToggleGroupRoot,
} from "../../design/components/GToggleGroup";
import GButton from "../../design/components/GButton.vue";
import { useConnectionsStore } from "../../stores/connections";

const store = useConnectionsStore();

/* The filters are one toggle group (Tab in once, arrows between them);
   each still writes to its own store flag. */
const shownLayers = computed(() => [
  ...(store.hiddenTypes.has("prereq") ? [] : ["prereq"]),
  ...(store.showRowLabels ? ["labels"] : []),
]);
function setShownLayers(next: string[]) {
  if (next.includes("prereq") === store.hiddenTypes.has("prereq")) {
    store.toggleType("prereq");
  }
  if (next.includes("labels") !== store.showRowLabels) {
    store.toggleRowLabels();
  }
}

const seedParts = computed((): string[] => {
  const count = store.seed.subjectIds.length;
  if (store.seed.origin === "road") {
    return count === 0
      ? ["No subjects yet"]
      : ["From your road", `${count} ${count === 1 ? "subject" : "subjects"}`];
  }
  if (store.seed.origin === "subject" || store.seed.origin === "manual") {
    return [`From ${store.seed.subjectIds[0] ?? ""}`];
  }
  return [];
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
/* The mode switch in the header already names the surface; the left slot
   states what the graph was seeded from. */
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
  /* outlined at rest: these are toggles and should read as controls */
  border: 1px solid var(--g-line-strong);
  border-radius: var(--radius-full);
  padding: var(--space-05) var(--space-2);
  cursor: pointer;
  transition:
    background-color var(--motion-quick) var(--ease-out),
    border-color var(--motion-quick) var(--ease-out),
    color var(--motion-quick) var(--ease-out);
}
/* :not(:disabled) matches GButton's own hover selector's specificity
   (.v-ghost:hover:not(:disabled)) so this neutral wash wins over its
   accent-tint one, rather than losing to a plain .legend-item:hover. */
.legend-item:hover:not(:disabled) {
  background: var(--g-surface-2);
}
.legend-item:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
/* On is filled, off is an empty outline: the two states have to differ
   by more than a shade of grey. data-state is the toggle group's. */
.legend-item[data-state="on"] {
  color: var(--g-ink);
  background: var(--g-surface-sunken);
}
.legend-item[data-state="on"]:hover:not(:disabled) {
  background: var(--g-line);
}
.legend-item[data-state="off"] {
  color: var(--g-ink-3);
  border-color: var(--g-line);
}
.legend-item[data-state="off"] .legend-text {
  text-decoration: line-through;
  text-decoration-color: var(--g-ink-3);
}
.legend-item[data-state="off"] .swatch {
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
  --swatch-color: var(--g-ink-2); /* matches GraphEdge's prereq color */
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
