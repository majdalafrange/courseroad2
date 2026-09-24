<template>
  <g-menu v-model="open" align="start" @close-auto-focus="onMenuClosed">
    <template #trigger>
      <button
        ref="triggerEl"
        class="switch-trigger"
        data-cy="roadSwitcher"
        :aria-label="triggerLabel"
      >
        <span class="switch-name">{{ activeName }}</span>
        <span v-if="roadIds.length > 1" class="switch-count"
          >{{ roadIds.length }} roads</span
        >
        <g-icon name="chevronDown" :size="13" class="switch-chevron" />
      </button>
    </template>

    <div class="switch-menu">
      <div class="switch-label">
        <g-menu-label as="span">Roads</g-menu-label>
        <g-tooltip text="New road">
          <g-menu-item
            class="switch-icon-btn g-hit"
            data-cy="addRoadButton"
            aria-label="New road"
            @select="createRoad"
          >
            <g-icon name="plus" :size="14" />
          </g-menu-item>
        </g-tooltip>
      </div>

      <!-- Each road is a radio item, so the active one is announced as
           checked. Its row actions are sibling menu items (the arrow keys
           walk road, rename, duplicate, delete, next road), revealed while
           the row is hovered or one of its items is highlighted. -->
      <g-menu-radio-group :model-value="activeRoad" @update:model-value="pick">
        <div
          v-for="roadId in roadIds"
          :key="roadId"
          class="switch-road"
          :class="{ active: roadId === activeRoad }"
        >
          <g-menu-radio-item
            :value="roadId"
            class="road-item"
            :data-cy="'roadTab' + roadId"
          >
            <span class="road-active-bar" aria-hidden="true" />
            <span class="road-name">{{ roads[roadId].name }}</span>
            <span class="road-count" aria-hidden="true">{{
              classCount(roadId) || ""
            }}</span>
            <span class="sr-only">{{ classCountLabel(roadId) }}</span>
          </g-menu-radio-item>
          <span class="road-actions">
            <g-tooltip text="Rename">
              <g-menu-item
                class="switch-icon-btn g-hit"
                data-cy="editRoadButton"
                :aria-label="`Rename ${roads[roadId].name}`"
                @select="queueRename(roadId)"
              >
                <g-icon name="pencil" :size="13" />
              </g-menu-item>
            </g-tooltip>
            <g-tooltip text="Duplicate">
              <g-menu-item
                class="switch-icon-btn g-hit"
                data-cy="duplicateRoadButton"
                :aria-label="`Duplicate ${roads[roadId].name}`"
                @select="emit('duplicate-road', roadId)"
              >
                <g-icon name="copy" :size="13" />
              </g-menu-item>
            </g-tooltip>
            <g-tooltip text="Delete">
              <g-menu-item
                class="switch-icon-btn g-hit"
                danger
                data-cy="deleteRoadButton"
                :aria-label="`Delete ${roads[roadId].name}`"
                @select="emit('delete-road', roadId)"
              >
                <g-icon name="trash" :size="13" />
              </g-menu-item>
            </g-tooltip>
          </span>
        </div>
      </g-menu-radio-group>

      <g-menu-separator />

      <g-menu-item data-cy="shareRoadButton" @select="emit('open-share')">
        <g-icon name="share" :size="14" />
        Share this road...
      </g-menu-item>
      <g-menu-item data-cy="importRoadButton" @select="emit('open-import')">
        <g-icon name="import" :size="14" />
        Import a road...
      </g-menu-item>
      <g-menu-item
        v-if="roadIds.length > 1"
        data-cy="compareRoadsButton"
        @select="emit('open-compare')"
      >
        <g-icon name="map" :size="14" />
        Compare roads...
      </g-menu-item>
    </div>
  </g-menu>

  <g-sheet
    v-model="renameOpen"
    label="Rename road"
    width="380px"
    initial-focus="input"
    @close-auto-focus="onRenameClosed"
  >
    <form class="rename-form" @submit.prevent="commitRename">
      <h2 class="rename-title">Rename road</h2>
      <g-input
        v-model="renameValue"
        label="Road name"
        data-cy="renameRoadField"
      />
      <div class="rename-actions">
        <g-button variant="ghost" @click="renameOpen = false">Cancel</g-button>
        <g-button variant="primary" type="submit">Save</g-button>
      </div>
    </form>
  </g-sheet>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import GButton from "../../design/components/GButton.vue";
import GIcon from "../../design/components/GIcon.vue";
import GInput from "../../design/components/GInput.vue";
import {
  GMenu,
  GMenuItem,
  GMenuLabel,
  GMenuRadioGroup,
  GMenuRadioItem,
  GMenuSeparator,
} from "../../design/components/GMenu";
import GSheet from "../../design/components/GSheet.vue";
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
  (e: "open-share"): void;
}>();

const store = useCourseDataStore();

const open = ref(false);
const roads = computed(() => store.roads);
const roadIds = computed(() => Object.keys(store.roads));
const activeRoad = computed(() => store.activeRoad);
const activeName = computed(
  () => store.roads[store.activeRoad]?.name ?? "CourseRoad",
);
const triggerLabel = computed(() =>
  roadIds.value.length > 1
    ? `Road: ${activeName.value}, one of ${roadIds.value.length}`
    : `Road: ${activeName.value}`,
);

function classCount(roadId: string): number {
  return flatten(store.roads[roadId].contents.selectedSubjects).length;
}

function classCountLabel(roadId: string): string {
  const count = classCount(roadId);
  return count === 1 ? ", 1 class" : `, ${count} classes`;
}

function pick(roadId: string) {
  emit("switch-road", roadId);
}

/* ---- rename: a small dialog, opened once the menu has closed ----
   The menu returns focus to its trigger as it closes; opening the dialog
   after that makes the trigger the dialog's focus-restore target too. */
const pendingRename = ref<string | null>(null);
const renamingId = ref<string | null>(null);
const renameValue = ref("");
const renameOpen = computed({
  get: () => renamingId.value !== null,
  set: (value: boolean) => {
    if (!value) {
      renamingId.value = null;
    }
  },
});

/* The dialog opens after the menu has gone, so what it saw as focused
   was nothing in particular; closing goes back to the switcher. */
const triggerEl = useTemplateRef("triggerEl");

function onRenameClosed(event: Event) {
  event.preventDefault();
  triggerEl.value?.focus();
}

function queueRename(roadId: string) {
  pendingRename.value = roadId;
}

function onMenuClosed() {
  const roadId = pendingRename.value;
  if (roadId === null) {
    return;
  }
  pendingRename.value = null;
  // After Reka's own return of focus to the trigger, which runs in the
  // same task as this event.
  setTimeout(() => startRename(roadId), 0);
}

function startRename(roadId: string) {
  const road = store.roads[roadId];
  if (road === undefined) {
    return;
  }
  renameValue.value = road.name;
  renamingId.value = roadId;
}

/* ---- creation: offer the rename right away ---- */
const awaitingNewRoad = ref(false);

function createRoad() {
  awaitingNewRoad.value = true;
  emit("create-road");
}

watch(roadIds, (now, before) => {
  if (!awaitingNewRoad.value) {
    return;
  }
  awaitingNewRoad.value = false;
  const added = now.find((id) => !before.includes(id));
  if (added !== undefined) {
    queueRename(added);
  }
});

function commitRename() {
  const roadId = renamingId.value;
  if (roadId === null) {
    return;
  }
  renamingId.value = null;
  const road = store.roads[roadId];
  if (road === undefined) {
    return;
  }
  const newName = renameValue.value.trim();
  if (newName === "" || newName === road.name) {
    return;
  }
  if (otherRoadHasName(store.roads, roadId, newName)) {
    toast.warn(
      `A road named “${newName}” already exists`,
      "The name was left unchanged.",
    );
    return;
  }
  store.setRoadName({ id: roadId, name: newName });
}
</script>

<style scoped>
/* The bare name read as a page title, so the switcher takes the search
   field's shell (fill and --g-line-control ring), and the chevron says
   it opens a list. */
.switch-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  max-width: 340px;
  height: 34px;
  font: var(--text-body-strong);
  color: var(--g-ink);
  background: var(--g-surface);
  border: none;
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--g-line-control);
  padding: 0 var(--space-3);
  cursor: pointer;
  transition: box-shadow var(--motion-quick) var(--ease-out);
}
/* The open menu keeps the hover ring, so the trigger reads as its owner. */
.switch-trigger:hover,
.switch-trigger[aria-expanded="true"] {
  box-shadow: inset 0 0 0 1px var(--g-ink-3);
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
.switch-count {
  font: var(--text-small);
  color: var(--g-ink-3);
  white-space: nowrap;
  flex-shrink: 0;
}
.switch-chevron {
  color: var(--g-ink-2);
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

/* Icon-sized menu items: .g-menu-item supplies the highlight and focus
   states; this only sizes them. */
.switch-icon-btn {
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: var(--radius-xs);
  color: var(--g-ink-3);
}

/* The row holds the road's radio item and, over its right end, the
   action items. */
.switch-road {
  position: relative;
  display: flex;
  align-items: center;
}
.road-item {
  position: relative;
  flex: 1;
  min-width: 0;
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
}
.switch-road:hover .road-item:not([data-highlighted]) {
  background: var(--g-surface-2);
  color: var(--g-ink);
}
.switch-road.active .road-item {
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
.road-count {
  width: 70px;
  flex-shrink: 0;
  text-align: right;
  font: var(--text-id-small);
  font-weight: 400;
  color: var(--g-ink-3);
  transition: opacity var(--motion-quick) var(--ease-out);
}
.road-actions {
  position: absolute;
  right: var(--space-2);
  display: inline-flex;
  align-items: center;
  gap: var(--space-05);
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
/* Touch: no hover state and a tap produces no :focus-visible, so the
   buttons stay visible and the count yields its slot. */
@media (max-width: 859px) {
  .switch-count {
    display: none;
  }
}
@media (hover: none) {
  .road-actions {
    opacity: 1;
    pointer-events: auto;
  }
  .road-count {
    opacity: 0;
  }
}

.rename-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
}
.rename-title {
  font: var(--text-heading);
  color: var(--g-ink);
  margin: 0;
}
.rename-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
