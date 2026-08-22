<template>
  <aside
    class="node-panel"
    :class="{ 'panel-right': courseData.panelSide === 'right' }"
    aria-label="Connections"
  >
    <!-- inline "add to a term"; discovery never leaves the graph -->
    <term-picker v-if="store.placementRequest" />

    <!-- selected node header -->
    <div v-if="subject" class="panel-head">
      <div class="panel-ident" :style="{ '--dept-color': color }">
        <div class="head-id-row">
          <h2 class="head-id" data-cy="connectionSelectedId">
            {{ subject.subject_id }}
          </h2>
          <button
            class="head-close"
            aria-label="Clear selection"
            @click="store.select(undefined)"
          >
            <g-icon name="close" :size="13" />
          </button>
        </div>
        <p class="head-title">{{ subject.title }}</p>
      </div>
      <p v-if="headFacts.length" class="head-facts">
        <template v-for="(fact, i) in headFacts" :key="fact.text"
          ><span v-if="i > 0"> · </span
          ><span :class="{ 'fact-warn': fact.warn }">{{
            fact.text
          }}</span></template
        >
      </p>
      <div v-if="headMissing.length" class="head-missing">
        <span class="missing-label">Needs</span>
        <button
          v-for="id in headMissing"
          :key="id"
          class="missing-chip"
          :title="`Show ${id} on the graph`"
          @click="store.revealMissingPrereq(subject.subject_id, id)"
        >
          {{ id }}
        </button>
        <span v-if="headMissingApproximate" class="missing-more">+ more</span>
      </div>
      <p v-if="subject.description" class="head-desc">
        {{ subject.description }}
      </p>
      <p v-if="headMetaParts.length" class="head-meta">
        <template v-for="(part, i) in headMetaParts" :key="i"
          ><span v-if="i > 0"> · </span
          ><g-icon
            v-if="part.icon"
            :name="part.icon"
            :size="10"
            class="rating-icon"
          />{{ part.icon ? " " : "" }}{{ part.text }}</template
        >
      </p>
      <div class="head-actions">
        <g-button
          v-if="isOnRoad"
          size="sm"
          variant="primary"
          title="Open it on your road"
          @click="emit('open', subject.subject_id)"
        >
          Go to it
        </g-button>
        <template v-else>
          <g-button
            size="sm"
            variant="primary"
            @click="emit('add', subject.subject_id)"
          >
            Add to road
          </g-button>
          <g-button size="sm" @click="emit('open', subject.subject_id)">
            Open
          </g-button>
        </template>
        <button class="icon-action" :title="expandTitle" @click="toggleExpand">
          {{ expandLabel }}
        </button>
        <button
          v-if="isExpanded && hasMore"
          class="icon-action"
          title="Hide the connections this node revealed"
          @click="store.collapse(store.selectedId!)"
        >
          Collapse
        </button>
        <button
          class="icon-action"
          :title="pinTitle"
          @click="store.togglePin(subject.subject_id)"
        >
          {{ isPinned ? "Unpin" : "Pin" }}
        </button>
        <button
          class="icon-action danger"
          title="Remove from graph"
          @click="store.remove(subject.subject_id)"
        >
          Remove
        </button>
      </div>
    </div>

    <!-- no selection -->
    <div v-else class="panel-empty-head">
      <h2 class="panel-empty-title">Connections</h2>
      <p class="panel-empty-copy">
        Select a subject on the graph. Its connections list here, ranked, with
        the reason for each.
      </p>
    </div>

    <!-- with nothing selected, the anchors are the way in -->
    <div v-if="!subject && anchors.length" class="panel-body">
      <div class="panel-section">
        Starting points
        <span class="section-count">{{ anchors.length }}</span>
      </div>
      <ul class="neighbor-list">
        <li v-for="a in anchors" :key="a.id">
          <button
            class="anchor-row"
            :style="{ '--dept-color': a.color }"
            @click="store.focusNode(a.id)"
          >
            <span class="neighbor-bar" aria-hidden="true" />
            <span class="neighbor-text">
              <span class="neighbor-id">{{ a.id }}</span>
              <span class="neighbor-title">{{ a.subject.title }}</span>
            </span>
          </button>
        </li>
      </ul>
    </div>

    <!-- ranked neighbors -->
    <div v-if="subject" class="panel-body">
      <div class="panel-section">
        Connections
        <span v-if="neighbors.length" class="section-count">{{
          neighbors.length
        }}</span>
      </div>

      <p v-if="!neighbors.length" class="panel-note">
        Nothing connected we can show yet.
      </p>

      <ul v-else class="neighbor-list">
        <li v-for="n in neighbors" :key="n.id">
          <div
            class="neighbor"
            :class="{
              crossing: n.crossing,
              stale: !n.offered,
              hovered: store.hoverId === n.id,
            }"
            @mouseenter="store.hover(n.id, 'panel')"
            @mouseleave="store.hover(undefined, 'panel')"
          >
            <div class="neighbor-row">
              <button
                class="neighbor-main"
                :data-cy="`connectionNeighbor_${n.id.replace('.', '_')}`"
                :title="
                  n.onCanvas ? `Select ${n.id}` : `Show ${n.id} on the graph`
                "
                @click="store.focusNeighbor(store.selectedId!, n.id)"
              >
                <span
                  class="neighbor-bar"
                  :style="{ '--dept-color': courseColor(n.subject) }"
                />
                <span class="neighbor-text">
                  <span class="neighbor-id-row">
                    <span class="neighbor-id">{{ n.id }}</span>
                    <span
                      v-if="n.crossing"
                      class="cross-flag"
                      title="Connects a different department"
                      >crossing</span
                    >
                    <span
                      v-if="n.onCanvas"
                      class="oncanvas-flag"
                      title="On the graph"
                    />
                  </span>
                  <span class="neighbor-title">{{ n.subject.title }}</span>
                  <span class="neighbor-reason">{{ n.reason }}</span>
                  <span class="neighbor-meta">
                    <template v-if="n.rating"
                      ><g-icon name="star" :size="10" class="rating-icon" />
                      {{ n.rating.toFixed(1) }}</template
                    >
                    <template v-if="n.hours">
                      · {{ Math.round(n.hours) }}h/wk</template
                    >
                    <template v-if="n.status"> · {{ n.status }}</template>
                    <span v-if="readyText(n)"> · {{ readyText(n) }}</span>
                    <span v-if="n.requirementBadge">
                      · {{ n.requirementBadge }}</span
                    >
                    <template v-if="!n.offered"> · not offered</template>
                  </span>
                </span>
              </button>
              <div class="neighbor-actions">
                <button
                  class="mini"
                  title="Add to a term"
                  @click="emit('add', n.id)"
                >
                  <g-icon name="plus" :size="13" />
                </button>
              </div>
            </div>
            <div
              v-if="n.readiness?.kind === 'missing'"
              class="neighbor-missing"
            >
              <span class="missing-label">Needs</span>
              <button
                v-for="id in n.readiness.missing.slice(0, 4)"
                :key="id"
                class="missing-chip"
                :title="`Show ${id} on the graph`"
                @click="store.revealMissingPrereq(n.id, id)"
              >
                {{ id }}
              </button>
              <span
                v-if="n.readiness.missing.length > 4 || n.readiness.approximate"
                class="missing-more"
                >+ more</span
              >
            </div>
          </div>
        </li>
      </ul>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";
import GButton from "../../design/components/GButton.vue";
import GIcon from "../../design/components/GIcon.vue";
import TermPicker from "./TermPicker.vue";
import { courseColor } from "../../lib/colors";
import { useConnectionsStore, type NodeView } from "../../stores/connections";
import { useCourseDataStore } from "../../stores/courseData";
import type { RankedNeighbor } from "../../lib/connections/rank";

const emit = defineEmits<{
  (e: "open", id: string): void;
  (e: "add", id: string): void;
}>();

const store = useConnectionsStore();
const courseData = useCourseDataStore();

const subject = computed(() => store.selectedSubject);
const neighbors = computed<RankedNeighbor[]>(() => store.rankedNeighbors);
const color = computed(() =>
  subject.value ? courseColor(subject.value) : "var(--g-line)",
);

const selectedNode = computed<NodeView | undefined>(() =>
  store.nodes.find((n) => n.id === store.selectedId),
);

/** The exploration's roots, listed when nothing is selected. */
const anchors = computed<NodeView[]>(() =>
  store.nodes.filter((n) => n.anchor).sort((a, b) => (a.id < b.id ? -1 : 1)),
);
const isExpanded = computed(() => selectedNode.value?.expanded ?? false);
const hasMore = computed(() => selectedNode.value?.hasMore ?? false);
const isPinned = computed(() => selectedNode.value?.pinned ?? false);
const isOnRoad = computed(() => selectedNode.value?.status !== undefined);

const expandLabel = computed(() => {
  if (!isExpanded.value) {
    return "Expand";
  }
  return hasMore.value ? "Show more" : "Collapse";
});
const expandTitle = computed(() =>
  isExpanded.value && !hasMore.value
    ? "Collapse connections"
    : "Expand connections",
);
const pinTitle = computed(() => (isPinned.value ? "Unpin" : "Pin in place"));

/**
 * Status renders as one quiet fact line, the same recipe as the meta line
 * below it. Warn ink marks offering doubt, the one exception here; the
 * rest is the normal case and stays neutral.
 */
interface Fact {
  text: string;
  warn?: boolean;
}
const selectedReadiness = computed(() =>
  subject.value === undefined ? undefined : store.readinessFor(subject.value),
);

const headFacts = computed<Fact[]>(() => {
  const node = selectedNode.value;
  const out: Fact[] = [];
  // road membership is conveyed by status; a seeded anchor that isn't on the
  // road is the exploration's starting point.
  if (node?.status) {
    out.push({ text: node.status === "taken" ? "Taken" : "Planned" });
  } else if (node?.anchor) {
    out.push({ text: "Starting point" });
  }
  const readiness = selectedReadiness.value;
  if (readiness !== undefined) {
    const text = store.readinessLabel(readiness);
    if (text !== undefined) {
      out.push({ text });
    }
  }
  if (node?.requirementBadge) {
    out.push({ text: node.requirementBadge });
  }
  if (node && !node.offered) {
    out.push({ text: "No longer offered", warn: true });
  }
  return out;
});

/** The selected subject's own unmet prerequisites, each one click away. */
const headMissing = computed<string[]>(() => {
  const readiness = selectedReadiness.value;
  return readiness?.kind === "missing" ? readiness.missing.slice(0, 6) : [];
});
const headMissingApproximate = computed(() => {
  const readiness = selectedReadiness.value;
  return (
    readiness?.kind === "missing" &&
    (readiness.approximate || readiness.missing.length > 6)
  );
});

/** "12 units", a star rating, "~15h/wk", "Fall, Spring" for the selected
 *  subject, dot-joined by the template. */
const headMetaParts = computed(() => {
  const s = subject.value;
  if (s === undefined) {
    return [];
  }
  const parts: { icon?: "star"; text: string }[] = [];
  if (s.total_units) {
    parts.push({ text: `${s.total_units} units` });
  }
  if (s.rating) {
    parts.push({ icon: "star", text: s.rating.toFixed(1) });
  }
  const hours = (s.in_class_hours ?? 0) + (s.out_of_class_hours ?? 0);
  if (hours > 0) {
    parts.push({ text: `~${Math.round(hours)}h/wk` });
  }
  const terms = [
    s.offered_fall ? "Fall" : undefined,
    s.offered_IAP ? "IAP" : undefined,
    s.offered_spring ? "Spring" : undefined,
  ].filter((t) => t !== undefined);
  if (terms.length > 0) {
    parts.push({ text: terms.join(", ") });
  }
  return parts;
});

/** Meta-line copy for a row's readiness (missing gets its own chips row). */
function readyText(n: RankedNeighbor): string | undefined {
  if (n.readiness === undefined || n.readiness.kind === "missing") {
    return undefined;
  }
  return store.readinessLabel(n.readiness);
}

function toggleExpand() {
  const id = store.selectedId;
  if (id === undefined) {
    return;
  }
  if (!isExpanded.value || hasMore.value) {
    store.expand(id);
  } else {
    store.collapse(id);
  }
}
</script>

<style scoped>
.node-panel {
  /* DOM order is canvas-then-panel (see ConnectionsPage.vue); this puts
     it first visually. */
  order: -1;
  width: 384px;
  flex-shrink: 0;
  height: 100%;
  background: var(--g-surface);
  border-right: 1px solid var(--g-line);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.node-panel.panel-right {
  order: 1;
  border-right: none;
  border-left: 1px solid var(--g-line);
}
@media (max-width: 1100px) {
  .node-panel {
    width: 340px;
  }
}
/* On small screens the panel rides over the canvas as a sheet; the page
   only renders it while a selection or a pending placement gives it work. */
@media (max-width: 859px) {
  .node-panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(56px + env(safe-area-inset-bottom, 0px));
    top: auto;
    width: 100%;
    height: auto;
    max-height: min(60dvh, 520px);
    border-right: none;
    border-left: none;
    border-top: 1px solid var(--g-line);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: var(--shadow-3);
  }
}

/* ---------- header ---------- */
.panel-head {
  padding: 0 var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--g-line);
}
/* Solid department color, the way legacy CourseRoad's own class-info
   card led with a colored header bar: identity is a color, not a
   hairline beside it. Only the id and title live in here; facts,
   actions, and the rest of the header stay neutral below it. */
.panel-ident {
  background: var(--dept-color);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  margin: var(--space-4) 0 var(--space-3);
}
.head-id-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.head-id {
  font: var(--text-title);
  font-family: var(--font-mono);
  margin: 0;
  color: var(--dept-on);
}
.head-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--dept-on-2);
  cursor: pointer;
}
.head-close:hover {
  background: color-mix(in srgb, var(--dept-on) 16%, transparent);
  color: var(--dept-on);
}
.head-title {
  font: var(--text-body);
  color: var(--dept-on-2);
  margin: var(--space-05) 0 0;
}
.head-facts {
  font: var(--text-small);
  color: var(--g-ink-2);
  margin: var(--space-2) 0 0;
}
.fact-warn {
  color: var(--g-warn);
}
.head-missing {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-2);
}
.head-desc {
  font: var(--text-small);
  color: var(--g-ink-2);
  margin: var(--space-2) 0 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.head-meta {
  font: var(--text-micro);
  color: var(--g-ink-3);
  margin: var(--space-1) 0 0;
}

/* an unmet prerequisite is the next hop of the exploration */
.missing-label {
  font: var(--text-micro);
  color: var(--g-ink-3);
}
.missing-chip {
  font: var(--text-micro);
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--g-accent);
  background: var(--g-accent-tint);
  border: none;
  border-radius: var(--radius-full);
  padding: 1px 7px;
  cursor: pointer;
  transition: background-color var(--motion-quick) var(--ease-out);
}
.missing-chip:hover {
  background: var(--g-accent);
  color: var(--g-surface);
}
.missing-more {
  font: var(--text-micro);
  color: var(--g-ink-3);
}
.head-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
.icon-action {
  font: var(--text-small);
  color: var(--g-ink-2);
  background: transparent;
  border: 1px solid var(--g-line-strong);
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
}
.icon-action:hover {
  background: var(--g-accent-tint);
  color: var(--g-ink);
}
.icon-action.danger {
  color: var(--g-danger);
  border-color: transparent;
}
.icon-action.danger:hover {
  background: var(--g-danger-tint);
}

.panel-empty-head {
  padding: var(--space-5) var(--space-4);
}
.panel-empty-title {
  font: var(--text-heading);
  margin: 0 0 var(--space-2);
}
.panel-empty-copy {
  font: var(--text-small);
  color: var(--g-ink-3);
  margin: 0;
}

/* ---------- body ---------- */
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2) var(--space-2) var(--space-8);
}
.panel-section {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
  color: var(--g-ink-3);
  padding: var(--space-3) var(--space-3) var(--space-2);
}
.section-count {
  color: var(--g-ink-2);
}
.panel-note {
  font: var(--text-small);
  color: var(--g-ink-3);
  padding: var(--space-2) var(--space-3);
}

.neighbor-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.neighbor {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-sm);
  transition: background-color var(--motion-quick) var(--ease-out);
}
.neighbor-row {
  display: flex;
  align-items: stretch;
}
.neighbor:hover,
.neighbor.hovered {
  background: var(--g-surface-2);
}
.neighbor.crossing {
  box-shadow: inset 2px 0 0 var(--g-warn);
}
.neighbor.stale {
  opacity: 0.7;
}
.neighbor-main {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: var(--space-2);
  text-align: left;
  background: transparent;
  border: none;
  padding: var(--space-2) var(--space-2);
  cursor: pointer;
}
/* rails rest mixed toward the hairline; the row's hover restores full
   chroma (the shared --dept-rest recipe) */
.neighbor-bar {
  width: 4px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
  background: color-mix(
    in srgb,
    var(--dept-color, var(--g-line-strong)) var(--dept-rest-mix),
    var(--g-line-strong)
  );
  transition: background-color var(--motion-quick) var(--ease-out);
}
.neighbor:hover .neighbor-bar,
.neighbor.hovered .neighbor-bar,
.anchor-row:hover .neighbor-bar,
.anchor-row:focus-visible .neighbor-bar {
  background: var(--dept-color, var(--g-line-strong));
}

.anchor-row {
  display: flex;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background-color var(--motion-quick) var(--ease-out);
}
.anchor-row:hover {
  background: var(--g-surface-2);
}
.anchor-row:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
.neighbor-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.neighbor-id-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.neighbor-id {
  font: var(--text-id-small);
  font-family: var(--font-mono);
  color: var(--g-ink);
  font-weight: 600;
}
/* a crossing is information; warn stays reserved for staleness */
.cross-flag {
  font: var(--text-micro);
  color: var(--g-info);
}
.oncanvas-flag {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--g-accent);
  flex-shrink: 0;
}
.neighbor-title {
  font: var(--text-small);
  color: var(--g-ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.neighbor-reason {
  font: var(--text-micro);
  color: var(--g-accent);
  margin-top: 1px;
}
.neighbor-meta {
  font: var(--text-micro);
  color: var(--g-ink-3);
}
.rating-icon {
  display: inline-block;
  vertical-align: -1px;
}
.neighbor-missing {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-2) var(--space-2)
    calc(var(--space-2) + 4px + var(--space-2));
}
.neighbor-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-05);
  padding-right: var(--space-1);
}
.mini {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--g-ink-3);
  cursor: pointer;
}
.mini:hover {
  background: var(--g-accent-tint);
  color: var(--g-accent);
}
</style>
