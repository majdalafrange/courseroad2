<template>
  <g-popover v-model="open" align="start" menu>
    <template #anchor>
      <button
        class="switch-trigger"
        data-cy="roadSwitcher"
        aria-haspopup="menu"
        :aria-expanded="open"
        @click="open = !open"
      >
        <span class="switch-name">{{ activeName }}</span>
        <g-icon name="chevronDown" :size="13" class="switch-chevron" />
      </button>
    </template>

    <div class="switch-menu" @click.stop>
      <div class="switch-label">
        <span>Roads</span>
        <g-tooltip text="New road">
          <button
            class="switch-icon-btn"
            data-cy="addRoadButton"
            aria-label="New road"
            @click="createRoad"
          >
            <g-icon name="plus" :size="14" />
          </button>
        </g-tooltip>
      </div>

      <div
        v-for="roadId in roadIds"
        :key="roadId"
        class="switch-road"
        :class="{ active: roadId === activeRoad }"
        :data-cy="'roadTab' + roadId"
        role="button"
        tabindex="0"
        @click="pick(roadId)"
        @keydown.enter.prevent="pick(roadId)"
      >
        <span class="road-active-bar" aria-hidden="true" />
        <template v-if="renamingId === roadId">
          <input
            ref="renameInput"
            v-model="renameValue"
            class="road-rename-input"
            data-cy="renameRoadField"
            @keydown.enter.prevent.stop="commitRename"
            @keydown.esc.prevent.stop="cancelRename"
            @blur="commitRename"
            @click.stop
          />
        </template>
        <template v-else>
          <span class="road-name" @dblclick.stop="startRename(roadId)">
            {{ roads[roadId].name }}
          </span>
          <span class="road-right">
            <span class="road-count">{{ classCount(roadId) || "" }}</span>
            <span class="road-actions" @click.stop>
              <g-tooltip text="Rename">
                <button
                  class="switch-icon-btn road-action-btn"
                  data-cy="editRoadButton"
                  aria-label="Rename road"
                  @click="startRename(roadId)"
                >
                  <g-icon name="pencil" :size="13" />
                </button>
              </g-tooltip>
              <g-tooltip text="Duplicate">
                <button
                  class="switch-icon-btn road-action-btn"
                  data-cy="duplicateRoadButton"
                  aria-label="Duplicate road"
                  @click="duplicateRoad(roadId)"
                >
                  <g-icon name="copy" :size="13" />
                </button>
              </g-tooltip>
              <g-tooltip text="Delete">
                <button
                  class="switch-icon-btn road-action-btn danger"
                  data-cy="deleteRoadButton"
                  aria-label="Delete road"
                  @click="deleteRoad(roadId)"
                >
                  <g-icon name="trash" :size="13" />
                </button>
              </g-tooltip>
            </span>
          </span>
        </template>
      </div>

      <div class="switch-divider" />

      <button class="switch-op" data-cy="importRoadButton" @click="openImport">
        <g-icon name="download" :size="14" />
        Import a road…
      </button>
      <button
        v-if="roadIds.length > 1"
        class="switch-op"
        data-cy="compareRoadsButton"
        @click="openCompare"
      >
        <g-icon name="map" :size="14" />
        Compare roads…
      </button>
    </div>
  </g-popover>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import GIcon from "../../design/components/GIcon.vue";
import GPopover from "../../design/components/GPopover.vue";
import GTooltip from "../../design/components/GTooltip.vue";
import { toast } from "../../design/toast";
import { otherRoadHasName } from "../../lib/roads";
import { flatten } from "../../lib/types";
import { useCourseDataStore } from "../../stores/courseData";

const emit = defineEmits<{
  (e: "create-road"): void;
  (e: "switch-road", roadID: string): void;
  (e: "duplicate-road", roadID: string): void;
  (e: "delete-road", roadID: string): void;
  (e: "open-import"): void;
  (e: "open-compare"): void;
}>();

const store = useCourseDataStore();

const open = ref(false);
const roads = computed(() => store.roads);
const roadIds = computed(() => Object.keys(store.roads));
const activeRoad = computed(() => store.activeRoad);
const activeName = computed(
  () => store.roads[store.activeRoad]?.name ?? "CourseRoad",
);

function classCount(roadId: string): number {
  return flatten(store.roads[roadId].contents.selectedSubjects).length;
}

function pick(roadId: string) {
  emit("switch-road", roadId);
  open.value = false;
}

function duplicateRoad(roadId: string) {
  emit("duplicate-road", roadId);
  open.value = false;
}

function deleteRoad(roadId: string) {
  emit("delete-road", roadId);
  open.value = false;
}

function openImport() {
  emit("open-import");
  open.value = false;
}

function openCompare() {
  emit("open-compare");
  open.value = false;
}

/* ---- creation: stay open and offer the rename right away ---- */
const awaitingNewRoad = ref(false);

function createRoad() {
  awaitingNewRoad.value = true;
  emit("create-road");
}

watch(roadIds, (now, before) => {
  if (!awaitingNewRoad.value || !open.value) {
    awaitingNewRoad.value = false;
    return;
  }
  const added = now.find((id) => !before.includes(id));
  if (added !== undefined) {
    awaitingNewRoad.value = false;
    startRename(added);
  }
});

/* ---- inline rename (double-click or the pencil) ---- */
const renamingId = ref<string | null>(null);
const renameValue = ref("");
const renameInput = ref<HTMLInputElement[] | HTMLInputElement>();

function startRename(roadId: string) {
  renamingId.value = roadId;
  renameValue.value = store.roads[roadId].name;
  nextTick(() => {
    const el = Array.isArray(renameInput.value)
      ? renameInput.value[0]
      : renameInput.value;
    el?.focus();
    el?.select();
  });
}

function commitRename() {
  const roadId = renamingId.value;
  if (roadId === null) {
    return;
  }
  renamingId.value = null;
  const newName = renameValue.value.trim();
  const oldName = store.roads[roadId].name;
  if (newName === "" || newName === oldName) {
    return;
  }
  if (otherRoadHasName(store.roads, roadId, newName)) {
    toast.warn(
      `There's already a road named “${newName}”`,
      "The name was left unchanged.",
    );
    return;
  }
  store.setRoadName({ id: roadId, name: newName });
}

function cancelRename() {
  renamingId.value = null;
}
</script>

<style scoped>
.switch-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  max-width: 340px;
  font: var(--text-heading);
  color: var(--g-ink);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  padding: 4px var(--space-2);
  margin-left: calc(var(--space-2) * -1);
  cursor: pointer;
  transition: background-color var(--motion-quick) var(--ease-out);
}
.switch-trigger:hover {
  background: var(--g-accent-tint);
}
.switch-trigger:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
.switch-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.switch-chevron {
  color: var(--g-ink-3);
  flex-shrink: 0;
}

.switch-menu {
  display: flex;
  flex-direction: column;
  width: 300px;
  max-height: min(480px, 70vh);
  overflow-y: auto;
}

.switch-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font: var(--text-small);
  color: var(--g-ink-3);
  padding: var(--space-1) var(--space-2) var(--space-2);
}

.switch-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--g-ink-3);
  cursor: pointer;
  transition: background-color var(--motion-quick) var(--ease-out);
}
.switch-icon-btn:hover {
  background: var(--g-accent-tint);
  color: var(--g-ink);
}
.switch-icon-btn.danger:hover {
  background: var(--g-danger-tint);
  color: var(--g-danger);
}
.switch-icon-btn:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}

.switch-road {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font: var(--text-body);
  color: var(--g-ink-2);
  transition:
    background-color var(--motion-quick) var(--ease-out),
    color var(--motion-quick) var(--ease-out);
}
.switch-road:hover {
  background: var(--g-surface-2);
  color: var(--g-ink);
}
.switch-road:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
.switch-road.active {
  background: var(--g-accent-tint);
  color: var(--g-ink);
  font-weight: 600;
}
.road-active-bar {
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: var(--radius-full);
  background: transparent;
  transition: background-color var(--motion-quick) var(--ease-out);
}
.switch-road.active .road-active-bar {
  background: var(--g-accent);
}
.road-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Fixed-width right slot: the count and the actions crossfade in place, so
   the road name never shifts when hovering. 3 × 22px actions + 2 × 2px gap. */
.road-right {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  width: 70px;
  flex-shrink: 0;
}
.road-count {
  font: var(--text-id-small);
  color: var(--g-ink-3);
  transition: opacity var(--motion-quick) var(--ease-out);
}
.road-actions {
  position: absolute;
  right: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--motion-quick) var(--ease-out);
}
.switch-road:hover .road-actions,
.switch-road:focus-within .road-actions {
  opacity: 1;
  pointer-events: auto;
}
.switch-road:hover .road-count,
.switch-road:focus-within .road-count {
  opacity: 0;
}
/* Touch: no hover state exists to reveal the actions and a tap produces
   no :focus-visible, so the buttons stay visible and the count yields
   its slot. A tap where the icons sit acts on the icon, not the row. */
@media (hover: none) {
  .road-actions {
    opacity: 1;
    pointer-events: auto;
  }
  .road-count {
    opacity: 0;
  }
}

.road-rename-input {
  flex: 1;
  min-width: 0;
  font: var(--text-body);
  font-weight: 600;
  color: var(--g-ink);
  background: var(--g-surface);
  border: none;
  border-radius: var(--radius-xs);
  padding: 2px var(--space-1);
  box-shadow:
    inset 0 0 0 1.5px var(--g-accent),
    0 0 0 3px var(--g-accent-tint);
  outline: none;
}

.switch-divider {
  height: 1px;
  background: var(--g-line);
  margin: var(--space-2);
}

.switch-op {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-body);
  color: var(--g-ink-2);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  text-align: left;
  transition: background-color var(--motion-quick) var(--ease-out);
}
.switch-op:hover {
  background: var(--g-accent-tint);
  color: var(--g-ink);
}
.switch-op:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
</style>
