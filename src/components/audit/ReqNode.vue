<template>
  <div class="req-node" :class="{ 'is-root': depth === 0 }">
    <!-- ============ branch ============ -->
    <div v-if="isBranch" class="branch-line">
      <button
        type="button"
        class="branch-row"
        :data-cy="'auditItem' + (node['list-id'] ?? '')"
        :aria-expanded="open"
        @click="open = !open"
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
          >{{ node.percent_fulfilled }}%<span class="sr-only">
            {{ node.fulfilled ? "fulfilled, complete" : "fulfilled" }}</span
          ></span
        >
      </button>
      <g-popover
        v-model="infoOpen"
        align="end"
        :label="`Details for ${branchTitle}`"
      >
        <template #anchor>
          <g-button
            variant="ghost"
            size="xs"
            icon-only
            :data-cy="'auditInfoButton' + (node['list-id'] ?? '')"
            :aria-label="`Details for ${branchTitle}`"
            aria-haspopup="dialog"
            :aria-expanded="infoOpen"
            @click.stop="infoOpen = !infoOpen"
          >
            <g-icon name="info" :size="12" />
          </g-button>
        </template>
        <div class="info-pop" @click.stop>
          <strong class="info-title">{{ branchTitle }}</strong>
          <p v-if="node.desc" class="info-desc">{{ node.desc }}</p>
          <g-progress
            v-if="showPercent"
            class="info-bar"
            :fill-class="['info-bar-fill', percentTone]"
            :value="Number(node.percent_fulfilled)"
            :get-value-label="
              () => `${branchTitle}: ${node.percent_fulfilled}% fulfilled`
            "
          />
          <div v-if="node.sat_courses?.length" class="info-sat">
            <span class="info-label">Satisfied by</span>
            <span class="info-courses">{{ node.sat_courses.join(", ") }}</span>
          </div>
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
      class="leaf-line"
      :class="{
        fulfilled: node.fulfilled,
        petitioned,
        ignored,
        'cross-lit': crossLit,
      }"
      @mouseenter="onLeafHover"
      @mouseleave="clearAuditHighlight()"
    >
      <button
        ref="leafEl"
        type="button"
        class="leaf-row"
        :data-cy="'auditItem' + (node['list-id'] ?? '')"
        @click="onLeafClick"
        @pointerdown="onLeafPointerDown"
        @focus="onLeafHover"
        @blur="clearAuditHighlight()"
      >
        <span class="leaf-state" :class="{ ok: leafSatisfied }">
          <g-icon
            :name="
              node['plain-string'] ? 'pencil' : leafSatisfied ? 'check' : 'dots'
            "
            :size="12"
          />
        </span>
        <span class="sr-only">{{ leafStateLabel }}:</span>
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
          <span v-if="chosenSubjects !== undefined" class="leaf-flag manual"
            >{{ chosenSubjects.length }}/{{ manualCutoff }}</span
          >
          <span v-else-if="petitioned" class="leaf-flag petition"
            >substituted</span
          >
          <span v-else-if="ignored" class="leaf-flag ignore">ignored</span>
          <span v-if="node.max === 0" class="leaf-flag optional">optional</span>
          <span
            v-if="chosenSubjects === undefined && manualValue !== undefined"
            class="leaf-flag manual"
            >{{ manualValue }}/{{ manualCutoff }}</span
          >
        </span>
      </button>

      <span class="leaf-actions">
        <g-button
          v-if="!leafSatisfied && !node['plain-string']"
          variant="ghost"
          size="xs"
          icon-only
          :aria-label="`Find classes for ${leafName}`"
          @click.stop="findClasses"
          @pointerdown.stop
        >
          <g-icon name="search" :size="12" />
        </g-button>
        <g-popover
          v-model="petitionOpen"
          align="end"
          :label="
            node['plain-string']
              ? `Progress on ${leafName}`
              : `Petition ${leafName}`
          "
        >
          <template #anchor>
            <g-button
              variant="ghost"
              size="xs"
              icon-only
              :aria-label="
                choosable
                  ? `Choose what counts for ${leafName}`
                  : node['plain-string']
                    ? `Enter progress for ${leafName}`
                    : `Petition or ignore ${leafName}`
              "
              aria-haspopup="dialog"
              :aria-expanded="petitionOpen"
              :data-cy="'petitionButton' + (node['list-id'] ?? '')"
              @click.stop="petitionOpen = !petitionOpen"
              @pointerdown.stop
            >
              <g-icon name="pencil" :size="12" />
            </g-button>
          </template>
          <div class="petition-pop" @click.stop @pointerdown.stop>
            <template v-if="node['plain-string']">
              <strong class="info-title"
                >Manual Progress: {{ branchTitle }}</strong
              >
              <template v-if="choosable">
                <p class="info-desc">
                  Because this requirement is custom to the individual, select
                  what subjects fulfill this requirement.
                </p>
                <div class="petition-courses" data-cy="chooseSubjects">
                  <g-checkbox
                    v-for="id in planSubjectIds"
                    :key="id"
                    class="petition-course"
                    :model-value="petitionDraft.includes(id)"
                    @update:model-value="togglePetitionCourse(id)"
                  >
                    <span class="leaf-req">{{ id }}</span>
                    <span v-if="usedElsewhere.has(id)" class="choose-use">
                      also {{ usedElsewhere.get(id)!.join(", ") }}
                    </span>
                  </g-checkbox>
                  <span v-if="!planSubjectIds.length" class="info-desc"
                    >No classes on the road yet.</span
                  >
                </div>
                <div class="petition-actions">
                  <span class="manual-of" role="status"
                    >{{ petitionDraft.length }} of
                    {{ manualCutoff }} chosen</span
                  >
                  <g-button
                    v-if="chosenSubjects !== undefined"
                    size="sm"
                    variant="ghost"
                    @click="saveChosen([])"
                  >
                    Clear
                  </g-button>
                  <g-button
                    size="sm"
                    variant="primary"
                    @click="saveChosen(petitionDraft)"
                  >
                    Save
                  </g-button>
                </div>
                <p class="info-desc">
                  Alternatively, manually enter how many subjects from this
                  requirement you have completed for your degree.
                </p>
              </template>
              <template v-else>
                <p class="info-desc">
                  Because this requirement is custom to the individual, you have
                  to manually enter how many units of this requirement you have
                  completed for your degree.
                </p>
              </template>
              <div class="manual-row">
                <g-number-field
                  v-model="manualDraft"
                  compact
                  :aria-label="`Progress on ${leafName}, out of ${manualCutoff}`"
                  :min="0"
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
                <g-checkbox
                  v-for="id in planSubjectIds"
                  :key="id"
                  class="petition-course"
                  :model-value="petitionDraft.includes(id)"
                  @update:model-value="togglePetitionCourse(id)"
                >
                  <span class="leaf-req">{{ id }}</span>
                </g-checkbox>
                <span v-if="!planSubjectIds.length" class="info-desc"
                  >No classes on the road yet.</span
                >
              </div>
              <div class="petition-actions">
                <g-checkbox
                  class="petition-ignore"
                  :model-value="ignored"
                  @update:model-value="toggleIgnore"
                >
                  Ignore entirely
                </g-checkbox>
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
import { computed, ref, useTemplateRef, watch } from "vue";
import GButton from "../../design/components/GButton.vue";
import GCheckbox from "../../design/components/GCheckbox.vue";
import GIcon from "../../design/components/GIcon.vue";
import GNumberField from "../../design/components/GNumberField.vue";
import GProgress from "../../design/components/GProgress.vue";
import GPopover from "../../design/components/GPopover.vue";
import {
  isIgnored,
  isPetitioned,
  manualProgress,
  subjectUses,
} from "../../lib/audit";
import type { RequirementNode } from "../../lib/types";
import { getSubject } from "../../lib/types";
import { useAuditStore } from "../../stores/audit";
import { rememberAuditOrigin } from "../../stores/auditFocus";
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
const leafEl = useTemplateRef("leafEl");

/* Expansion lives in the audit store, keyed programKey + "/" + list-id,
   so it survives the row unmounting when a branch above it closes or the
   road switches. list-id is stable within a program; uniqueKey renumbers
   on removal. */
const nodeKey = computed(
  () => props.programKey + "/" + (props.node["list-id"] ?? ""),
);
const open = computed({
  get: () => auditStore.isNodeOpen(nodeKey.value),
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

/* A plain-string leaf's substitution is only a count toward its
   threshold, so FireRoad's verdict decides. */
const leafSatisfied = computed(
  () =>
    Boolean(props.node.fulfilled) ||
    (petitioned.value && !props.node["plain-string"]),
);

/** What the state icon shows, for a screen reader. */
const leafStateLabel = computed(() => {
  if (props.node["plain-string"]) {
    return props.node.fulfilled ? "Satisfied" : "Enter progress by hand";
  }
  return leafSatisfied.value ? "Satisfied" : "Not yet satisfied";
});

/** The leaf's name for its action buttons' labels. */
const leafName = computed(
  () => props.node.req ?? props.node.title ?? "this requirement",
);

/* ---- manual progress (plain-string leaves) ---- */
const manualCutoff = computed(() => props.node.threshold?.cutoff ?? 1);
const manualValue = computed(() => {
  const listID = props.node["list-id"];
  if (!props.node["plain-string"] || listID === undefined) {
    return undefined;
  }
  const contents = store.roads[store.activeRoad]?.contents;
  return contents === undefined ? undefined : manualProgress(contents, listID);
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

/* ---- chosen subjects (plain-string leaves counted in subjects) ---- */
/** Counted in subjects, so they can be picked from the road. */
const choosable = computed(
  () =>
    Boolean(props.node["plain-string"]) &&
    (props.node.threshold?.criterion ?? "subjects") === "subjects",
);
const chosenSubjects = computed(() => {
  const listID = props.node["list-id"];
  if (!props.node["plain-string"] || listID === undefined) {
    return undefined;
  }
  return assertions.value[listID]?.substitutions;
});
/** What each road subject already counts for elsewhere in this program. */
const usedElsewhere = computed(() => {
  const tree = auditStore.reqTrees[props.programKey];
  return tree === undefined ? new Map<string, string[]>() : subjectUses(tree);
});

function saveChosen(subjects: string[]) {
  const listID = props.node["list-id"];
  if (listID !== undefined) {
    store.chooseRequirementSubjects({ listID, subjects: [...subjects] });
  }
  petitionOpen.value = false;
}

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
    // closing the detail puts focus back on this row
    rememberAuditOrigin(leafEl.value);
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
.branch-line {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
}
.branch-line:hover {
  background: var(--g-surface-2);
}
.branch-row {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: calc(-1 * var(--space-2)) 0 calc(-1 * var(--space-2))
    calc(-1 * var(--space-2));
  padding: var(--space-2) 0 var(--space-2) var(--space-2);
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  user-select: none;
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
/* fulfilled earns the progress green; mid and low are one gray (a 1.4:1
   text distinction reads as none) */
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
.leaf-line {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-xs);
  transition: background-color var(--motion-quick) var(--ease-out);
}
.leaf-line:hover {
  background: var(--g-surface-2);
}
.leaf-line.cross-lit {
  background: var(--g-ok-tint);
  box-shadow: inset 2px 0 0 var(--g-ok);
}
.leaf-line.ignored {
  opacity: 0.55;
}
.leaf-row {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: calc(-1 * var(--space-1)) 0 calc(-1 * var(--space-1))
    calc(-1 * var(--space-2));
  padding: var(--space-1) 0 var(--space-1) var(--space-2);
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: none;
  border-radius: var(--radius-xs);
  cursor: pointer;
  user-select: none;
}
.leaf-row:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
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

/* Reserved width (2 × 24 + 2 gap) so the row never reflows on reveal.
   The negative margin lets the 24px buttons overhang the row's padding
   instead of making every leaf row taller. */
.leaf-actions {
  margin: -1px 0;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-05);
  flex-shrink: 0;
  min-width: 50px;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--motion-quick) var(--ease-out);
}
.leaf-line:hover .leaf-actions,
.leaf-line:focus-within .leaf-actions {
  opacity: 1;
  pointer-events: auto;
}
/* Touch: no hover to reveal these, and petitioning has no other entry
   point. The slot is already reserved. */
@media (hover: none) {
  .leaf-actions {
    opacity: 1;
    pointer-events: auto;
  }
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
/* :deep(): GProgress's own indicator, a grandchild from here. */
:deep(.info-bar-fill) {
  display: block;
  height: 100%;
}
:deep(.info-bar-fill.tone-ok) {
  background: var(--g-progress);
}
:deep(.info-bar-fill.tone-mid) {
  background: var(--g-progress);
}
:deep(.info-bar-fill.tone-low) {
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
  gap: var(--space-05);
}

.manual-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.manual-row .g-number-field {
  width: 64px;
}
.manual-of {
  font: var(--text-small);
  color: var(--g-ink-3);
  flex: 1;
}

.choose-use {
  font: var(--text-micro);
  color: var(--g-ink-3);
  margin-left: var(--space-1);
}
.petition-courses {
  display: flex;
  flex-direction: column;
  gap: var(--space-05);
  max-height: 180px;
  overflow-y: auto;
}
.petition-course {
  font: var(--text-small);
  padding: 0 var(--space-1);
  border-radius: var(--radius-xs);
}
.petition-course:hover {
  background: var(--g-surface-2);
}
.petition-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  border-top: 1px solid var(--g-line);
  padding-top: var(--space-2);
}
.petition-ignore {
  font: var(--text-small);
  color: var(--g-ink-2);
  flex: 1;
}
</style>
