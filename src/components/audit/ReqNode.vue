<template>
  <div class="req-node" :class="{ 'is-root': depth === 0 }">
    <!-- ============ branch ============ -->
    <div
      v-if="isBranch"
      class="branch-row"
      :data-cy="'auditItem' + (node['list-id'] ?? '')"
      role="button"
      tabindex="0"
      :aria-expanded="open"
      @click="open = !open"
      @keydown.enter.prevent="open = !open"
    >
      <g-icon
        name="chevronRight"
        :size="12"
        class="branch-chevron"
        :style="{ transform: open ? 'rotate(90deg)' : '' }"
      />
      <span class="branch-title">{{ branchTitle }}</span>
      <span v-if="node['threshold-desc']" class="branch-threshold">{{
        node["threshold-desc"]
      }}</span>
      <span
        v-if="showPercent"
        class="branch-percent"
        :class="percentTone"
        :data-cy="'percentFulfilled' + (node['list-id'] ?? '')"
        >{{ node.percent_fulfilled }}%</span
      >
      <g-popover v-model="infoOpen" align="end">
        <template #anchor>
          <button
            class="row-action"
            :data-cy="'auditInfoButton' + (node['list-id'] ?? '')"
            aria-label="Requirement details"
            @click.stop="infoOpen = !infoOpen"
          >
            <g-icon name="info" :size="12" />
          </button>
        </template>
        <div class="info-pop" @click.stop>
          <strong class="info-title">{{ branchTitle }}</strong>
          <p v-if="node.desc" class="info-desc">{{ node.desc }}</p>
          <div v-if="showPercent" class="info-bar">
            <span
              class="info-bar-fill"
              :class="percentTone"
              :style="{
                width: Math.min(100, Number(node.percent_fulfilled)) + '%',
              }"
            />
          </div>
          <div v-if="node.sat_courses?.length" class="info-sat">
            <span class="info-label">Satisfied by</span>
            <span class="info-courses">{{ node.sat_courses.join(", ") }}</span>
          </div>
          <a
            v-if="node.url"
            class="info-link"
            :href="safeHref(node.url)"
            target="_blank"
            rel="noopener"
            >Official requirements ↗</a
          >
        </div>
      </g-popover>
      <span v-if="showPercent" class="branch-bar" aria-hidden="true">
        <span
          class="branch-bar-fill"
          :class="percentTone"
          :style="{
            width: Math.min(100, Number(node.percent_fulfilled)) + '%',
          }"
        />
      </span>
    </div>
    <div v-if="isBranch && open" class="branch-children">
      <req-node
        v-for="(child, index) in node.reqs"
        :key="child.uniqueKey ?? index"
        :node="child"
        :depth="depth + 1"
        :program-key="programKey"
      />
    </div>

    <!-- ============ leaf ============ -->
    <div
      v-if="!isBranch"
      class="leaf-row"
      :class="{
        fulfilled: node.fulfilled,
        petitioned,
        ignored,
        'cross-lit': crossLit,
      }"
      :data-cy="'auditItem' + (node['list-id'] ?? '')"
      role="button"
      tabindex="0"
      @click="onLeafClick"
      @keydown.enter.prevent="onLeafClick"
      @pointerdown="onLeafPointerDown"
      @mouseenter="onLeafHover"
      @mouseleave="clearAuditHighlight()"
    >
      <span class="leaf-state" :class="{ ok: leafSatisfied }">
        <g-icon
          :name="
            node['plain-string'] ? 'pencil' : leafSatisfied ? 'check' : 'dots'
          "
          :size="12"
        />
      </span>
      <span class="leaf-label">
        <span
          v-if="node.req !== undefined"
          class="leaf-req"
          :class="{ done: leafSatisfied }"
          >{{ node.req }}</span
        >
        <span v-if="node.title" class="leaf-title">{{ node.title }}</span>
        <span v-if="node['threshold-desc']" class="leaf-threshold"
          >({{ node["threshold-desc"] }})</span
        >
        <span v-if="petitioned" class="leaf-flag petition">substituted</span>
        <span v-else-if="ignored" class="leaf-flag ignore">ignored</span>
        <span v-if="node.max === 0" class="leaf-flag optional">optional</span>
        <span v-if="manualValue !== undefined" class="leaf-flag manual"
          >{{ manualValue }}/{{ manualCutoff }}</span
        >
      </span>

      <span class="leaf-actions">
        <button
          v-if="!leafSatisfied && !node['plain-string']"
          class="row-action"
          aria-label="Find classes for this requirement"
          @click.stop="findClasses"
          @pointerdown.stop
        >
          <g-icon name="search" :size="12" />
        </button>
        <g-popover v-model="petitionOpen" align="end">
          <template #anchor>
            <button
              class="row-action"
              aria-label="Petition or ignore this requirement"
              :data-cy="'petitionButton' + (node['list-id'] ?? '')"
              @click.stop="petitionOpen = !petitionOpen"
              @pointerdown.stop
            >
              <g-icon name="pencil" :size="12" />
            </button>
          </template>
          <div class="petition-pop" @click.stop @pointerdown.stop>
            <template v-if="node['plain-string']">
              <strong class="info-title">Manual progress</strong>
              <p class="info-desc">
                No subjects are listed for this requirement. Enter how much you
                have completed.
              </p>
              <div class="manual-row">
                <input
                  v-model.number="manualDraft"
                  class="manual-input"
                  type="number"
                  min="0"
                  :max="manualCutoff"
                />
                <span class="manual-of">of {{ manualCutoff }}</span>
                <g-button size="sm" variant="primary" @click="saveManual">
                  Save
                </g-button>
              </div>
            </template>
            <template v-else>
              <strong class="info-title">Petition this requirement</strong>
              <p class="info-desc">
                Substitute classes from your plan, or ignore the requirement
                entirely.
              </p>
              <div class="petition-courses">
                <label
                  v-for="id in planSubjectIds"
                  :key="id"
                  class="petition-course"
                >
                  <input
                    type="checkbox"
                    :checked="petitionDraft.includes(id)"
                    @change="togglePetitionCourse(id)"
                  />
                  <span class="leaf-req">{{ id }}</span>
                </label>
                <span v-if="!planSubjectIds.length" class="info-desc"
                  >No classes on the road yet.</span
                >
              </div>
              <div class="petition-actions">
                <label class="petition-ignore">
                  <input
                    type="checkbox"
                    :checked="ignored"
                    @change="toggleIgnore"
                  />
                  Ignore entirely
                </label>
                <g-button
                  size="sm"
                  variant="primary"
                  :disabled="ignored || petitionDraft.length === 0"
                  @click="savePetition"
                >
                  Substitute
                </g-button>
                <g-button
                  v-if="petitioned || ignored"
                  size="sm"
                  variant="ghost"
                  @click="resetPetition"
                >
                  Reset
                </g-button>
              </div>
            </template>
          </div>
        </g-popover>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import GButton from "../../design/components/GButton.vue";
import GIcon from "../../design/components/GIcon.vue";
import GPopover from "../../design/components/GPopover.vue";
import { isIgnored, isPetitioned } from "../../lib/audit";
import { safeHref } from "../../lib/courseLinks";
import type { RequirementNode } from "../../lib/types";
import { getSubject } from "../../lib/types";
import { useAuditStore } from "../../stores/audit";
import { useCourseDataStore } from "../../stores/courseData";
import { pointerDown } from "../../stores/dragdrop";
import {
  clearAuditHighlight,
  highlightAuditCourses,
  highlightState,
} from "../../stores/highlight";
import { requestPalette } from "../../stores/palette";

const props = defineProps<{
  node: RequirementNode;
  depth: number;
  programKey: string;
}>();

const store = useCourseDataStore();
const auditStore = useAuditStore();

/* Expansion lives in the audit store, keyed programKey + "/" + list-id,
   so it survives the panel swapping between audit and class detail.
   list-id is stable within a program; uniqueKey renumbers on removal. */
const nodeKey = computed(
  () => props.programKey + "/" + (props.node["list-id"] ?? ""),
);
const open = computed({
  get: () => auditStore.expanded[nodeKey.value] ?? props.depth < 1,
  set: (value) => auditStore.setNode(nodeKey.value, value),
});
const infoOpen = ref(false);
const petitionOpen = ref(false);

const isBranch = computed(() => props.node.reqs !== undefined);

const branchTitle = computed(() => {
  const node = props.node;
  return (
    (node["title-no-degree"] !== "" && node["title-no-degree"]) ||
    (node["medium-title"] !== "" && node["medium-title"]) ||
    (node["short-title"] !== "" && node["short-title"]) ||
    node.title ||
    ""
  );
});

const showPercent = computed(
  () =>
    props.node.percent_fulfilled !== undefined &&
    props.node.percent_fulfilled !== "N/A",
);

const percentTone = computed(() => {
  if (props.node.fulfilled) {
    return "tone-ok";
  }
  const percent = Number(props.node.percent_fulfilled);
  return percent > 15 ? "tone-mid" : "tone-low";
});

/* ---- assertions ---- */
const assertions = computed(
  () => store.roads[store.activeRoad]?.contents.progressAssertions ?? {},
);
const petitioned = computed(() =>
  isPetitioned(assertions.value, props.node["list-id"]),
);
const ignored = computed(() =>
  isIgnored(assertions.value, props.node["list-id"]),
);

const leafSatisfied = computed(
  () => Boolean(props.node.fulfilled) || petitioned.value,
);

/* ---- manual progress (plain-string leaves) ---- */
const manualCutoff = computed(() => props.node.threshold?.cutoff ?? 1);
const manualValue = computed(() => {
  const listID = props.node["list-id"];
  if (!props.node["plain-string"] || listID === undefined) {
    return undefined;
  }
  return store.roads[store.activeRoad]?.contents.progressOverrides[listID];
});
const manualDraft = ref(0);
watch(petitionOpen, (openNow) => {
  if (openNow) {
    manualDraft.value = manualValue.value ?? 0;
    petitionDraft.value = [
      ...(assertions.value[props.node["list-id"] ?? ""]?.substitutions ?? []),
    ];
  }
});

function saveManual() {
  const listID = props.node["list-id"];
  if (listID !== undefined) {
    store.updateProgress({ listID, progress: manualDraft.value });
  }
  petitionOpen.value = false;
}

/* ---- petitions ---- */
const planSubjectIds = computed(() => {
  const road = store.roads[store.activeRoad];
  if (road === undefined) {
    return [];
  }
  return [
    ...new Set(road.contents.selectedSubjects.flat().map((s) => s.subject_id)),
  ];
});

const petitionDraft = ref<string[]>([]);

function togglePetitionCourse(id: string) {
  if (petitionDraft.value.includes(id)) {
    petitionDraft.value = petitionDraft.value.filter((c) => c !== id);
  } else {
    petitionDraft.value.push(id);
  }
}

function savePetition() {
  const listID = props.node["list-id"];
  if (listID !== undefined && petitionDraft.value.length > 0) {
    store.setPASubstitutions({
      uniqueKey: listID,
      newReqs: [...petitionDraft.value],
    });
  }
  petitionOpen.value = false;
}

function toggleIgnore() {
  const listID = props.node["list-id"];
  if (listID !== undefined) {
    store.setPAIgnore({ uniqueKey: listID, isIgnored: !ignored.value });
  }
}

function resetPetition() {
  const listID = props.node["list-id"];
  if (listID !== undefined) {
    store.removeProgressAssertion(listID);
  }
  petitionOpen.value = false;
}

/* ---- leaf interactions ---- */
function onLeafClick() {
  const req = props.node.req;
  if (req === undefined) {
    return;
  }
  if (props.node["plain-string"]) {
    petitionOpen.value = true;
    return;
  }
  let usedReq = req;
  if (usedReq.indexOf("GIR:") === 0) {
    usedReq = usedReq.substring(4);
  }
  if (getSubject(store.catalog, usedReq) !== undefined) {
    store.pushClassStack(usedReq);
  } else {
    // course ranges like "6.00x": scope the palette to them
    requestPalette({ query: req });
  }
}

function onLeafPointerDown(event: PointerEvent) {
  const req = props.node.req;
  if (req === undefined || props.node["plain-string"]) {
    return;
  }
  let usedReq = req;
  if (usedReq.indexOf("GIR:") === 0) {
    usedReq = usedReq.substring(4);
  }
  const subject = getSubject(store.catalog, usedReq);
  if (subject !== undefined) {
    store.dragStartClass({ classInfo: subject });
    pointerDown(event, { subject, isNew: true });
  }
}

const ATTRIBUTE_TOKENS: Record<string, string> = {
  "HASS-A": "hass-a",
  "HASS-S": "hass-s",
  "HASS-H": "hass-h",
  "HASS-E": "hass-e",
  "CI-H": "ci-h",
  "CI-HW": "ci-hw",
  "GIR:LAB": "lab",
  "GIR:REST": "rest",
};

function findClasses() {
  const req = props.node.req ?? "";
  const token = ATTRIBUTE_TOKENS[req];
  if (token !== undefined) {
    requestPalette({ tokens: [token] });
  } else {
    requestPalette({ query: req.replace(/^GIR:/, "") });
  }
}

/* ---- bidirectional highlighting ---- */
function onLeafHover() {
  const courses = props.node.sat_courses ?? [];
  if (courses.length) {
    highlightAuditCourses(courses);
  }
}

/** Canvas → audit: glow when the hovered class feeds this requirement. */
const crossLit = computed(
  () =>
    highlightState.subjectId !== null &&
    (props.node.sat_courses ?? []).includes(highlightState.subjectId),
);
</script>

<script lang="ts">
export default { name: "ReqNode" };
</script>

<style scoped>
.req-node {
  width: 100%;
}

/* ---------- branch ---------- */
.branch-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  user-select: none;
}
.branch-row:hover {
  background: var(--g-surface-2);
}
.branch-row:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
.branch-chevron {
  color: var(--g-ink-3);
  transition: transform var(--motion-quick) var(--ease-out);
  flex-shrink: 0;
}
.branch-title {
  font: var(--text-body-strong);
  color: var(--g-ink);
  min-width: 0;
  overflow: hidden;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.branch-threshold {
  font: var(--text-small);
  color: var(--g-ink-3);
  font-style: italic;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.branch-percent {
  font: var(--text-id-small);
  margin-left: auto;
  flex-shrink: 0;
}
/* fulfilled earns the progress green (encodes, not decorates);
   mid and low are one gray; a 1.4:1 text distinction reads as none */
.tone-ok {
  color: var(--g-progress);
}
.tone-mid,
.tone-low {
  color: var(--g-ink-3);
}

/* the bar sits on the row's bottom edge; the row's own padding clears it */
.branch-bar {
  position: absolute;
  left: var(--space-2);
  right: var(--space-2);
  bottom: 0;
  height: 2px;
  border-radius: var(--radius-full);
  background: var(--g-line);
  overflow: hidden;
}
.branch-bar-fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-full);
  transition: width var(--motion-deliberate) var(--ease-out);
}
.branch-bar-fill.tone-ok {
  background: var(--g-progress);
}
.branch-bar-fill.tone-mid {
  background: var(--g-progress);
}
.branch-bar-fill.tone-low {
  background: var(--g-ink-3);
}

.branch-children {
  margin-left: var(--space-4);
  border-left: 1px solid var(--g-line);
  padding-left: var(--space-2);
}

/* ---------- leaf ---------- */
.leaf-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-xs);
  cursor: pointer;
  user-select: none;
  transition: background-color var(--motion-quick) var(--ease-out);
}
.leaf-row:hover {
  background: var(--g-surface-2);
}
.leaf-row:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
.leaf-row.cross-lit {
  background: var(--g-ok-tint);
  box-shadow: inset 2px 0 0 var(--g-ok);
}
.leaf-row.ignored {
  opacity: 0.55;
}

.leaf-state {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: var(--radius-full);
  background: var(--g-surface-sunken);
  color: var(--g-ink-3);
  flex-shrink: 0;
}
.leaf-state.ok {
  background: var(--g-progress-tint);
  color: var(--g-progress);
}

.leaf-label {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.leaf-req {
  font: var(--text-id-small);
  color: var(--g-ink);
}
.leaf-req.done {
  color: var(--g-ink);
}
.leaf-title {
  font: var(--text-small);
  color: var(--g-ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.leaf-threshold {
  font: var(--text-small);
  font-style: italic;
  color: var(--g-ink-3);
}
.leaf-flag {
  font: var(--text-small);
  border-radius: var(--radius-full);
  padding: 0 var(--space-2);
}
.leaf-flag.petition {
  background: var(--g-warn-tint);
  color: var(--g-warn);
}
.leaf-flag.ignore {
  background: var(--g-surface-sunken);
  color: var(--g-ink-3);
}
.leaf-flag.optional {
  color: var(--g-ink-3);
}
.leaf-flag.manual {
  background: var(--g-info-tint);
  color: var(--g-info);
}

/* Reserved width (2 × 22 + 2 gap) so the row never reflows on reveal. */
.leaf-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  flex-shrink: 0;
  min-width: 46px;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--motion-quick) var(--ease-out);
}
.leaf-row:hover .leaf-actions,
.leaf-row:focus-within .leaf-actions {
  opacity: 1;
  pointer-events: auto;
}
/* Touch: no hover state to reveal these, and petitioning or ignoring a
   requirement has no other entry point. The slot is already reserved, so
   showing them costs no reflow. */
@media (hover: none) {
  .leaf-actions {
    opacity: 1;
    pointer-events: auto;
  }
}

.row-action {
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
}
.row-action:hover {
  background: var(--g-accent-tint);
  color: var(--g-ink);
}
.row-action:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}

/* ---------- popovers ---------- */
.info-pop,
.petition-pop {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 280px;
}
.info-title {
  font: var(--text-body-strong);
  color: var(--g-ink);
}
.info-desc {
  font: var(--text-small);
  color: var(--g-ink-2);
  margin: 0;
}
.info-bar {
  height: 5px;
  border-radius: var(--radius-full);
  background: var(--g-line);
  overflow: hidden;
}
.info-bar-fill {
  display: block;
  height: 100%;
}
.info-bar-fill.tone-ok {
  background: var(--g-progress);
}
.info-bar-fill.tone-mid {
  background: var(--g-progress);
}
.info-bar-fill.tone-low {
  background: var(--g-ink-3);
}
.info-label {
  font: var(--text-small);
  color: var(--g-ink-3);
}
.info-courses {
  font: var(--text-id-small);
  color: var(--g-ink-2);
}
.info-sat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.info-link {
  font: var(--text-small);
  color: var(--g-accent);
  text-decoration: none;
}

.manual-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
/* the GInput shell recipe, at field-in-popover size */
.manual-input {
  font: var(--text-id);
  color: var(--g-ink);
  width: 64px;
  background: var(--g-surface);
  border: none;
  border-radius: var(--radius-xs);
  box-shadow: inset 0 0 0 1px var(--g-line-strong);
  padding: var(--space-1) var(--space-2);
  outline: none;
  transition: box-shadow var(--motion-quick) var(--ease-out);
}
.manual-input:hover {
  box-shadow: inset 0 0 0 1px var(--g-ink-3);
}
.manual-input:focus {
  box-shadow:
    inset 0 0 0 1.5px var(--g-accent),
    0 0 0 3px var(--g-accent-tint);
}
.manual-of {
  font: var(--text-small);
  color: var(--g-ink-3);
  flex: 1;
}

.petition-courses {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 180px;
  overflow-y: auto;
}
.petition-course {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
  cursor: pointer;
  padding: 2px var(--space-1);
  border-radius: var(--radius-xs);
}
.petition-course:hover {
  background: var(--g-surface-2);
}
.petition-course input,
.petition-ignore input {
  accent-color: var(--g-accent);
}
.petition-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  border-top: 1px solid var(--g-line);
  padding-top: var(--space-2);
}
.petition-ignore {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font: var(--text-small);
  color: var(--g-ink-2);
  cursor: pointer;
  flex: 1;
}
</style>
