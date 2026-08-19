<template>
  <aside
    class="progress-panel"
    :class="{ 'panel-right': store.panelSide === 'right' }"
  >
    <audit-panel
      v-if="activeRoad !== '' && activeRoad in roads"
      :ledger="detailOpen && !isMobile"
      data-cy="audit"
    />
    <!-- One mount at a time (aside or sheet) so ClassDetail's window
         keydown listener never registers twice. Crossing 860px remounts
         the detail and loses its scroll position. -->
    <class-detail v-if="detailOpen && !isMobile" class="panel-detail" />
    <div class="progress-foot" data-cy="unofficialWarning">
      <span class="foot-line">
        Unofficial tool. Confirm with the
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://student.mit.edu/cgi-bin/shrwsdau.sh"
          >official audit</a
        >
      </span>
      <g-popover v-model="footLinksOpen" align="end" placement="top">
        <template #anchor>
          <button
            class="foot-more"
            :aria-expanded="footLinksOpen"
            @click="footLinksOpen = !footLinksOpen"
          >
            more
          </button>
        </template>
        <div class="foot-links" @click.stop>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://student.mit.edu/catalog/index.cgi"
            >Subject listing <g-icon name="external" :size="11"
          /></a>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://catalog.mit.edu/degree-charts/"
            >Degree charts <g-icon name="external" :size="11"
          /></a>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://fireroad.mit.edu/requirements/"
            >Requirement wrong? Request an edit
            <g-icon name="external" :size="11"
          /></a>
          <a href="mailto:courseroad@mit.edu">courseroad@mit.edu</a>
        </div>
      </g-popover>
    </div>
  </aside>

  <div class="shell-main">
    <main id="canvasScroll" class="canvas">
      <!-- The glyph field sizes to the plan, not the viewport, so it
           scrolls with the cards instead of sitting still behind them. -->
      <div class="canvas-sheet">
        <canvas-glyphs />
        <div v-if="store.catalogError" class="catalog-error" role="alert">
          <div>
            <strong>We couldn't load the subject catalog.</strong>
            <span>
              Check your connection. Your plan is safe in the meantime.
            </span>
          </div>
          <g-button variant="primary" size="sm" @click="store.retryCatalog()">
            Try again
          </g-button>
        </div>
        <div v-else-if="offline" class="offline-note" role="status">
          <g-icon name="cloud" :size="14" />
          You're offline, but you can keep planning. We'll sync your changes
          when you're back.
        </div>
        <div v-else-if="roadLoading" class="road-loading" role="status">
          <span class="road-loading-spinner" aria-hidden="true" />
          Loading this road...
        </div>

        <div v-if="showEmptyState && !store.catalogError" class="empty-state">
          <h2 class="empty-title">Search for a class</h2>
          <p class="empty-copy">
            Place it in a term, or add a major or minor on the
            {{ store.panelSide }} and we'll show you what's left.
          </p>
          <div class="empty-actions">
            <g-button variant="primary" @click.stop="focusSearch">
              Add classes
            </g-button>
          </div>
        </div>

        <road-canvas
          v-if="activeRoad !== '' && activeRoad in roads && !roadLoading"
          :key="activeRoad"
          :selected-subjects="roads[activeRoad].contents.selectedSubjects"
          :road-i-d="activeRoad"
          @change-year="auth.changeSemester($event)"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import AuditPanel from "../../components/audit/AuditPanel.vue";
import ClassDetail from "../../components/detail/ClassDetail.vue";
import CanvasGlyphs from "../../components/canvas/CanvasGlyphs.vue";
import RoadCanvas from "../../components/canvas/RoadCanvas.vue";
import GButton from "../../design/components/GButton.vue";
import GIcon from "../../design/components/GIcon.vue";
import GPopover from "../../design/components/GPopover.vue";
import { useIsMobile } from "../../composables/useIsMobile";
import { flatten } from "../../lib/types";
import { requestPalette } from "../../stores/palette";
import { useAuthStore } from "../../stores/auth";
import { useCourseDataStore } from "../../stores/courseData";

const store = useCourseDataStore();
const auth = useAuthStore();
const isMobile = useIsMobile();

const footLinksOpen = ref(false);

const roads = computed(() => store.roads);
const activeRoad = computed(() => store.activeRoad);
const detailOpen = computed(() => store.classInfoStack.length > 0);
// True while the active road is still a blank placeholder awaiting its
// first fetch (see auth.retrieveRoad). Without this its empty placeholder
// reads as "Search for a class" instead of "still loading".
const roadLoading = computed(() =>
  store.unretrieved.includes(activeRoad.value),
);
const showEmptyState = computed(() => {
  if (roadLoading.value) {
    return false;
  }
  const road = store.roads[store.activeRoad];
  if (road === undefined) {
    return false;
  }
  return flatten(road.contents.selectedSubjects).length === 0;
});

/* ---- network ---- */
const offline = ref(!navigator.onLine);
function onOnline() {
  offline.value = false;
}
function onOffline() {
  offline.value = true;
}
onMounted(() => {
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
});
onBeforeUnmount(() => {
  window.removeEventListener("online", onOnline);
  window.removeEventListener("offline", onOffline);
});

/* ---- search ---- */
function focusSearch() {
  requestPalette({});
}
</script>

<style scoped>
.progress-panel {
  width: 384px;
  flex-shrink: 0;
  background: var(--g-surface);
  border-right: 1px solid var(--g-line);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* Settings' panel-side choice: DOM order stays panel-then-main (the
   default, left-side layout); "right" just reorders and re-sides the
   border. */
.progress-panel.panel-right {
  order: 1;
  border-right: none;
  border-left: 1px solid var(--g-line);
}

/* With a detail open the audit above it compresses to a ledger, and the
   detail takes the remaining height with its own scroll. */
.progress-panel .panel-detail {
  flex: 1;
  min-height: 0;
  border-top: 1px solid var(--g-line);
  animation: detail-enter var(--motion-standard) var(--ease-out);
}
@keyframes detail-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .progress-panel .panel-detail {
    animation: none;
  }
}

/* The disclaimer holds one quiet line; the rest lives behind “more”. */
.progress-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font: var(--text-small);
  color: var(--g-ink-3);
  padding: var(--space-2) var(--space-4);
  border-top: 1px solid var(--g-line);
}
.progress-foot a {
  color: var(--g-ink-2);
}
.foot-line {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.foot-more {
  font: var(--text-small);
  color: var(--g-ink-3);
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.foot-more:hover {
  color: var(--g-ink);
}
.foot-more:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
  border-radius: var(--radius-xs);
}
.foot-links {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font: var(--text-small);
}
.foot-links a {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--g-ink-2);
  text-decoration: none;
}
.foot-links a:hover {
  color: var(--g-accent);
}

.shell-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.canvas {
  flex: 1;
  overflow-y: auto;
  /* The padding is named so the glyph field can stretch back across it
     (see CanvasGlyphs.vue); keep the two declarations together. */
  --canvas-pad-top: var(--space-4);
  --canvas-pad-x: var(--space-5);
  --canvas-pad-bottom: var(--space-16);
  padding: var(--canvas-pad-top) var(--canvas-pad-x) var(--canvas-pad-bottom);
}
/* Holds the plan and the glyph field together. The field is absolute against
   this sheet, so it spans the whole plan rather than one screen of it, and
   every card stacks above it. */
.canvas-sheet {
  position: relative;
  min-height: 100%;
  /* Contain child margins: the empty state's top margin used to collapse
     through the sheet, shifting it (and the field with it) 20px down and
     leaving the top run of padding bare. */
  display: flow-root;
}
.canvas-sheet > *:not(.glyph-field) {
  position: relative;
  z-index: 1;
}

.empty-state {
  /* Wide enough to hold the instruction on one line (it measures 467px). */
  max-width: 480px;
  margin: var(--space-5) auto var(--space-5);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}
.empty-title {
  font: var(--text-display);
  letter-spacing: var(--tracking-tight);
  margin: 0;
}
.empty-copy {
  font: var(--text-body);
  color: var(--g-ink-2);
  margin: 0;
}
.empty-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.catalog-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  max-width: 1080px;
  margin: 0 auto var(--space-3);
  background: var(--g-danger-tint);
  border: 1px solid var(--g-danger);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}
.catalog-error strong {
  font: var(--text-body-strong);
  color: var(--g-ink);
  display: block;
}
.catalog-error span {
  font: var(--text-small);
  color: var(--g-ink-2);
}
.offline-note,
.road-loading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  max-width: 1080px;
  margin: 0 auto var(--space-3);
  font: var(--text-small);
  color: var(--g-ink-2);
  background: var(--g-surface-2);
  border: 1px solid var(--g-line);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
}
.road-loading-spinner {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  border: 2px solid transparent;
  border-top-color: currentColor;
  animation: road-loading-spin 800ms linear infinite;
}
@keyframes road-loading-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .road-loading-spinner {
    animation: none;
    border-color: currentColor;
  }
}

/* ---------- responsive ----------
   The ancestor classes below (.shell, .is-mobile, .show-plan,
   .show-progress) live on App.vue's shell wrapper; only the rightmost
   class in each selector needs to belong to this component for scoped
   CSS to still match it there. */
@media (max-width: 859px) {
  .shell.is-mobile .shell-main,
  .shell.is-mobile .progress-panel {
    width: 100%;
    height: auto;
    flex: 1;
    min-height: 0;
    border-right: none;
    border-left: none;
  }
  .shell.is-mobile .canvas {
    --canvas-pad-top: var(--space-3);
    --canvas-pad-x: var(--space-3);
    --canvas-pad-bottom: calc(64px + var(--space-4));
    padding: var(--canvas-pad-top) var(--canvas-pad-x) var(--canvas-pad-bottom);
  }
  .shell.is-mobile .progress-panel {
    padding-bottom: 64px;
  }
  /* Show one pane at a time; MobileNav switches. The class detail is not
     part of this trade: below 860px it renders in DetailSheet, over the
     whole shell, so a palette result is visible from either pane. */
  .shell.is-mobile.show-plan .progress-panel {
    display: none;
  }
  .shell.is-mobile.show-progress .shell-main {
    display: none;
  }
}
</style>
