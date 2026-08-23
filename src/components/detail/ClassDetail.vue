<template>
  <div
    v-if="subject"
    id="classInfoCard"
    class="class-detail"
    data-cy="classInfoCard"
  >
    <!-- viewed-class trail -->
    <div class="detail-trail">
      <div ref="trailPathEl" class="trail-path">
        <button
          v-for="(id, index) in trail"
          :key="index"
          class="trail-crumb"
          :class="{ current: index === activeIndex }"
          :data-cy="
            index === activeIndex - 1 ? 'cardPreviousButton' : undefined
          "
          :title="id"
          :aria-current="index === activeIndex ? 'page' : undefined"
          @click="store.setActiveClass(index)"
        >
          {{ id }}
        </button>
      </div>
      <button
        class="trail-close"
        aria-label="Close panel"
        data-cy="closeClassInfoButton"
        @click="store.clearClassInfoStack()"
      >
        <g-icon name="close" :size="13" />
      </button>
    </div>

    <div ref="bodyEl" class="detail-body">
      <!-- identity -->
      <div
        class="detail-ident"
        :style="{ '--dept-color': courseColor(subject) }"
      >
        <h2 class="detail-id">
          {{ subject.subject_id
          }}<sub v-if="subject.old_id" class="detail-old-id">{{
            subject.old_id
          }}</sub>
        </h2>
        <p class="detail-title" data-cy="cardSubjectTitle">
          {{ subject.title }}
        </p>
      </div>

      <!-- alerts -->
      <p v-if="subject.is_historical" class="detail-alert">
        <g-icon name="warn" :size="13" />
        No longer offered. Last ran
        {{ (subject.source_semester ?? "").split("-").join(" ") }}.
      </p>
      <p v-else-if="subject.not_offered_year" class="detail-alert">
        <g-icon name="warn" :size="13" />
        Sitting out the {{ subject.not_offered_year }} school year.
      </p>

      <!-- on the road? -->
      <div v-if="onRoadBucket >= 0" class="detail-onroad">
        <g-icon name="map" :size="13" />
        <span
          >On your road: <strong>{{ bucketName(onRoadBucket) }}</strong></span
        >
        <button class="onroad-action" @click="jumpToBucket(onRoadBucket)">
          Jump to it
        </button>
        <button class="onroad-action" @click="moveIt">Move it</button>
      </div>

      <!-- decision line: one row of facts, not a tile grid -->
      <p class="detail-stats">
        <span
          v-if="subject.rating !== undefined"
          class="stat"
          data-cy="cardRating"
        >
          <a :href="evaluationsUrl" target="_blank" rel="noopener"
            ><g-icon name="star" :size="11" />
            {{ subject.rating.toFixed(1) }}</a
          ><span class="stat-label">/7</span>
        </span>
        <span v-if="totalHours !== null" class="stat" data-cy="cardHours">
          <span :class="hoursTone">{{ totalHours.toFixed(1) }}</span>
          <span class="stat-label">h/wk{{ isGeneric ? "*" : "" }}</span>
        </span>
        <span
          v-if="subject.total_units !== undefined"
          class="stat"
          data-cy="cardUnits"
        >
          {{ subject.total_units }}
          <span class="stat-label">
            units{{ unitsSplit ? ` (${unitsSplit})` : "" }}
          </span>
        </span>
        <span
          v-if="subject.enrollment_number !== undefined"
          class="stat"
          data-cy="cardEnrollment"
        >
          {{ Math.round(subject.enrollment_number) }}
          <span class="stat-label">enrolled</span>
        </span>
      </p>
      <p v-if="hoursVerdict" class="detail-verdict" :class="hoursTone">
        {{ hoursVerdict }}
        <g-tooltip wide placement="bottom">
          <button
            class="verdict-why"
            type="button"
            :aria-label="hoursExplainer"
            data-cy="hoursExplainer"
          >
            <g-icon name="info" :size="12" />
          </button>
          <template #content>{{ hoursExplainer }}</template>
        </g-tooltip>
      </p>
      <p v-if="isGeneric" class="detail-note">
        *Hours averaged over all {{ subject.subject_id }} subjects.
      </p>

      <!-- explore connections: not offered on mobile -->
      <button
        v-if="inCatalog && !isMobile"
        class="explore-link"
        data-cy="exploreFromDetail"
        @click="exploreFromHere"
      >
        <g-icon name="graph" :size="14" />
        Show in Connections
      </button>

      <!-- add to a term -->
      <section v-if="!placing" class="detail-section">
        <h3 class="section-head">Add to a term</h3>
        <!-- Same notice the Connections term picker carries. Units count
             once per placement, so a repeat also counts twice. -->
        <p
          v-if="onRoadBucket >= 0"
          class="repeat-note"
          data-cy="cardRepeatNote"
        >
          Already on your road ({{
            onRoadBucket < store.currentSemester ? "taken" : "planned"
          }}). This adds a repeat.
        </p>
        <div class="term-fit-grid" data-cy="cardOffered">
          <button
            v-for="fit in termFits"
            :key="fit.index"
            class="term-fit"
            :class="fit.kind"
            :disabled="fit.kind === 'unavailable'"
            :title="fit.hint"
            @click="placeInTerm(fit.index)"
          >
            {{ fit.label }}
          </button>
        </div>
        <button
          class="inline-place"
          data-cy="addClassFromCardButton"
          @click="store.addFromCard(subject)"
        >
          or place it on the canvas
        </button>
      </section>
      <section v-else class="detail-section">
        <g-button variant="ghost" size="sm" @click="store.cancelAddFromCard()">
          Cancel placing
        </g-button>
      </section>

      <!-- prerequisites -->
      <section v-if="parsedPrereqs.reqs.length" class="detail-section">
        <h3 class="section-head">
          Prerequisites
          <span v-if="parsedPrereqs.fulfilled" class="head-ok"
            >(satisfied by your plan)</span
          >
        </h3>
        <prereq-tree :node="parsedPrereqs" data-cy="cardPrereqs" />
      </section>
      <p v-if="subject.either_prereq_or_coreq" class="either-note">
        or, at the same time
      </p>
      <section v-if="parsedCoreqs.reqs.length" class="detail-section">
        <h3 class="section-head">
          Corequisites
          <span v-if="parsedCoreqs.fulfilled" class="head-ok">(satisfied)</span>
        </h3>
        <prereq-tree :node="parsedCoreqs" />
      </section>

      <!-- facts -->
      <section class="detail-section">
        <h3 class="section-head">Details</h3>
        <dl class="facts">
          <template v-if="subject.instructors?.length">
            <dt>Taught by</dt>
            <dd data-cy="cardInstructors">
              {{ subject.instructors.join(", ") }}
            </dd>
          </template>
          <template v-if="subject.virtual_status !== undefined">
            <dt>Format</dt>
            <dd data-cy="cardVirtual">{{ virtualLabel }}</dd>
          </template>
          <template v-if="offeredSummary">
            <dt>Offered</dt>
            <dd>{{ offeredSummary }}</dd>
          </template>
        </dl>
        <p class="detail-desc" data-cy="cardDescription">
          {{ subject.description }}
        </p>
        <div class="external-links">
          <a
            v-if="subject.url"
            :href="safeHref(subject.url)"
            target="_blank"
            rel="noopener"
            >Catalog <g-icon name="external" :size="11"
          /></a>
          <a
            v-if="inCatalog"
            :href="evaluationsUrl"
            target="_blank"
            rel="noopener"
            >Evaluations <g-icon name="external" :size="11"
          /></a>
          <a
            v-if="inCatalog"
            :href="openGradesUrl"
            target="_blank"
            rel="noopener"
            >OpenGrades <g-icon name="external" :size="11"
          /></a>
        </div>
      </section>

      <!-- unlocks -->
      <section v-if="unlocks.length" class="detail-section">
        <h3 class="section-head">
          Prerequisite for {{ unlocks.length }}
          {{ unlocks.length === 1 ? "subject" : "subjects" }}
        </h3>
        <div class="chip-wrap">
          <button
            v-for="unlocked in visibleUnlocks"
            :key="unlocked.subject_id"
            class="subject-chip"
            :style="{ '--dept-color': courseColor(unlocked) }"
            :title="unlocked.title"
            @click="store.pushClassStack(unlocked.subject_id)"
            @pointerdown="dragSubject($event, unlocked)"
          >
            {{ unlocked.subject_id }}
          </button>
          <button
            v-if="unlocks.length > unlockLimit"
            class="subject-chip more"
            @click="unlockLimit += 24"
          >
            +{{ unlocks.length - unlockLimit }} more
          </button>
        </div>
      </section>

      <!-- related -->
      <section
        v-for="group in relatedGroups"
        :key="group.label"
        class="detail-section"
        :data-cy="group.dataCy"
      >
        <h3 class="section-head">{{ group.label }}</h3>
        <div class="chip-wrap">
          <button
            v-for="related in group.subjects"
            :key="related.subject_id"
            class="subject-chip"
            :style="{ '--dept-color': courseColor(related) }"
            :title="related.title"
            @click="store.pushClassStack(related.subject_id)"
            @pointerdown="dragSubject($event, related)"
          >
            {{ related.subject_id }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRouter } from "vue-router";
import GButton from "../../design/components/GButton.vue";
import GIcon from "../../design/components/GIcon.vue";
import GTooltip from "../../design/components/GTooltip.vue";
import PrereqTree from "./PrereqTree.vue";
import { useIsMobile } from "../../composables/useIsMobile";
import { courseColor } from "../../lib/colors";
import { safeHref } from "../../lib/courseLinks";
import {
  firstAppearance,
  parseRequirements,
  subjectsWithPrereq,
} from "../../lib/prereqTree";
import {
  placementStatus,
  baseYear,
  bucketName,
  semesterCalendarYearShort,
  semesterType,
} from "../../lib/offering";
import type { Subject } from "../../lib/types";
import { getSubject } from "../../lib/types";
import { useCourseDataStore } from "../../stores/courseData";
import { pointerDown } from "../../stores/dragdrop";

const store = useCourseDataStore();
const router = useRouter();
const bodyEl = ref<HTMLElement>();
const isMobile = useIsMobile();

/** Seed Connections from this subject (the highest-intent entry point). */
function exploreFromHere() {
  if (subject.value !== undefined) {
    const path =
      store.activeRoad !== "" ? `/explore/${store.activeRoad}` : "/explore";
    void router.push({
      path,
      query: { from: subject.value.subject_id },
    });
  }
}
const trailPathEl = ref<HTMLElement>();
const unlockLimit = ref(24);

/* The viewed classes form one navigation trail; the active crumb is shown. */
const trail = computed(() => store.classInfoStack);
const activeIndex = computed(() => store.activeClassIndex);

const subject = computed<Subject | undefined>(() => {
  const currentID = store.classInfoStack[store.activeClassIndex];
  return currentID === undefined
    ? undefined
    : getSubject(store.catalog, currentID);
});

watch(subject, () => {
  bodyEl.value?.scrollTo({ top: 0 });
  unlockLimit.value = 24;
  // Keep the active crumb visible if the trail has scrolled.
  void nextTick(() => {
    trailPathEl.value
      ?.querySelector(".trail-crumb.current")
      ?.scrollIntoView({ inline: "nearest", block: "nearest" });
  });
});

/* ---- placement ---- */
const placing = computed(() => store.addingFromCard);

const selectedSubjects = computed(
  () => store.roads[store.activeRoad]?.contents.selectedSubjects ?? [],
);

const onRoadBucket = computed(() =>
  subject.value === undefined
    ? -1
    : firstAppearance(selectedSubjects.value, subject.value.subject_id),
);

function jumpToBucket(index: number) {
  const cell = document.querySelector(
    `[data-cy="road_${store.activeRoad.replace(/\$/g, "\\$")}__semester_${index}"]`,
  );
  cell?.scrollIntoView({ behavior: "smooth", block: "center" });
  cell?.classList.add("jump-flash");
  setTimeout(() => cell?.classList.remove("jump-flash"), 1200);
}

function moveIt() {
  if (subject.value === undefined || onRoadBucket.value < 0) {
    return;
  }
  const bucket = selectedSubjects.value[onRoadBucket.value];
  const classIndex = bucket.findIndex(
    (s) => s.subject_id === subject.value?.subject_id,
  );
  if (classIndex >= 0) {
    store.removeClass({ classInfo: bucket[classIndex], classIndex });
    store.addFromCard(subject.value);
  }
}

interface TermFit {
  index: number;
  label: string;
  kind: string;
  hint: string;
}

const termFits = computed<TermFit[]>(() => {
  if (subject.value === undefined) {
    return [];
  }
  const base = baseYear(store.userYear);
  const fits: TermFit[] = [];
  for (let i = Math.max(1, store.currentSemester); i < 16; i++) {
    if (store.hideIAP && (i - 1) % 3 === 1) {
      continue;
    }
    const kind = placementStatus(
      subject.value,
      i,
      store.currentSemester,
      base,
    ).kind;
    const season = semesterType(i);
    fits.push({
      index: i,
      label: `${season === "Fall" ? "F" : season === "IAP" ? "I" : "S"}’${semesterCalendarYearShort(i, base)}`,
      kind,
      hint:
        kind === "ok"
          ? `Offered. Add to ${bucketName(i)}`
          : kind === "unavailable"
            ? "Not offered this term"
            : "May not be offered. Add anyway",
    });
  }
  return fits;
});

function placeInTerm(index: number) {
  if (subject.value === undefined) {
    return;
  }
  store.addClass({
    overrideWarnings: false,
    semester: index,
    title: subject.value.title,
    subject_id: subject.value.subject_id,
    units: subject.value.total_units,
  });
  jumpToBucket(index);
}

/* ---- stats ---- */
const isGeneric = computed(
  () =>
    subject.value !== undefined &&
    subject.value.subject_id in store.genericIndex,
);
const inCatalog = computed(
  () =>
    subject.value !== undefined &&
    subject.value.subject_id in store.subjectsIndex,
);

const totalHours = computed(() => {
  const s = subject.value;
  if (
    s === undefined ||
    (s.in_class_hours === undefined && s.out_of_class_hours === undefined)
  ) {
    return null;
  }
  return (s.in_class_hours ?? 0) + (s.out_of_class_hours ?? 0);
});

/**
 * Hours relative to the units norm (1 unit ≈ 1 h/week), ±35% band,
 * symmetric on purpose. Evaluation hours run systematically below the
 * nominal count, so the old −15% floor fired on 57% of subjects with
 * hours (it marked the norm, not an exception). Keep these thresholds
 * algebraically identical to `hoursVerdict` below (ratio ≥ 1.35 ==
 * diff ≥ 0.35×units; ratio ≤ 0.65 == diff ≤ −0.35×units) so the tint and
 * the sentence never disagree.
 */
const hoursTone = computed(() => {
  if (totalHours.value === null || subject.value?.total_units === undefined) {
    return "";
  }
  const ratio = totalHours.value / Math.max(1, subject.value.total_units);
  if (ratio >= 1.35) {
    return "tone-heavy";
  }
  if (ratio <= 0.65) {
    return "tone-light";
  }
  return "";
});

const hoursVerdict = computed(() => {
  if (totalHours.value === null || subject.value?.total_units === undefined) {
    return null;
  }
  const units = subject.value.total_units;
  const diff = totalHours.value - units;
  if (diff >= 0.35 * units) {
    return `Runs ${diff.toFixed(0)}h a week over its ${units} units.`;
  }
  if (diff <= -0.35 * units) {
    return `Lighter than its ${units} units suggest.`;
  }
  return null;
});

/**
 * Why the verdict line above says what it says. MIT counts a unit as an
 * hour of work a week, so the unit count is the claim and the evaluation
 * hours are what students actually reported. The line appears when the two
 * disagree by more than the thresholds in `hoursVerdict`.
 */
const hoursExplainer = computed(() => {
  const s = subject.value;
  if (s?.total_units === undefined || totalHours.value === null) {
    return "";
  }
  const units = s.total_units;
  const hours = totalHours.value.toFixed(1);
  const reported = isGeneric.value
    ? `Subject evaluations put ${s.subject_id} subjects at ${hours}h a week on average.`
    : `Subject evaluations put this one at ${hours}h.`;
  return (
    `A unit is meant to be an hour of work a week, so ${units} units should ` +
    `come to about ${units}h. ${reported} The note shows up once the gap ` +
    `passes 35% either way.`
  );
});

const unitsSplit = computed(() => {
  const s = subject.value;
  if (
    s?.lecture_units === undefined ||
    s.lab_units === undefined ||
    s.preparation_units === undefined
  ) {
    return null;
  }
  return `${s.lecture_units}-${s.lab_units}-${s.preparation_units}`;
});

const virtualLabel = computed(() => {
  switch (subject.value?.virtual_status) {
    case "Virtual":
      return "Virtual";
    case "In-Person":
      return "In person";
    case "Virtual/In-Person":
      return "Partly virtual";
    default:
      return "";
  }
});

const offeredSummary = computed(() => {
  const s = subject.value;
  if (s === undefined) {
    return "";
  }
  const terms = [
    s.offered_fall ? "Fall" : null,
    s.offered_IAP ? "IAP" : null,
    s.offered_spring ? "Spring" : null,
    s.offered_summer ? "Summer" : null,
  ].filter(Boolean);
  return terms.length ? terms.join(" · ") : "no scheduled terms";
});

// Subject ids are encoded before they reach these third-party URLs: a
// custom activity's id is typed by the user, and an imported road can carry
// any string, so an unencoded value could add or overwrite query parameters
// on someone else's site.
const evaluationsUrl = computed(
  () =>
    "https://sisapp.mit.edu/ose-rpt/subjectEvaluationSearch.htm?search=Search&subjectCode=" +
    encodeURIComponent(subject.value?.subject_id ?? ""),
);
const openGradesUrl = computed(
  () =>
    "https://opengrades.mit.edu/classes/aggregate/" +
    encodeURIComponent(subject.value?.subject_id ?? "") +
    "?utm_source=courseroad",
);

/* ---- prereq trees ---- */
const classFirstAppearance = computed(() =>
  subject.value === undefined
    ? -1
    : firstAppearance(selectedSubjects.value, subject.value.subject_id),
);

const EMPTY_PARSED = {
  reqs: [],
  topLevel: true,
  connectionType: "" as const,
  fulfilled: false,
};

const parsedPrereqs = computed(() =>
  subject.value?.prerequisites !== undefined
    ? parseRequirements(
        subject.value.prerequisites,
        store.catalog,
        selectedSubjects.value,
        classFirstAppearance.value,
      )
    : EMPTY_PARSED,
);

const parsedCoreqs = computed(() =>
  subject.value?.corequisites !== undefined
    ? parseRequirements(
        subject.value.corequisites,
        store.catalog,
        selectedSubjects.value,
        classFirstAppearance.value,
      )
    : EMPTY_PARSED,
);

/* ---- unlocks + related ---- */
const unlocks = computed(() =>
  subject.value === undefined
    ? []
    : subjectsWithPrereq(subject.value, store.subjectsInfo as Subject[]),
);

const visibleUnlocks = computed(() =>
  unlocks.value.slice(0, unlockLimit.value),
);

const relatedGroups = computed(() => {
  const s = subject.value;
  if (s === undefined) {
    return [];
  }
  const resolve = (ids: string[] | undefined) =>
    (ids ?? []).map(
      (id) =>
        getSubject(store.catalog, id) ??
        ({ subject_id: id, title: "" } as Subject),
    );
  return [
    {
      label: "Joint with",
      dataCy: "cardJointSubjects",
      subjects: resolve(s.joint_subjects),
    },
    {
      label: "Equivalent",
      dataCy: "cardEquivalentSubjects",
      subjects: resolve(s.equivalent_subjects),
    },
    {
      label: "Related",
      dataCy: "cardRelatedSubjects",
      subjects: resolve(s.related_subjects),
    },
  ].filter((group) => group.subjects.length > 0);
});

function dragSubject(event: PointerEvent, target: Subject) {
  if (getSubject(store.catalog, target.subject_id) !== undefined) {
    store.dragStartClass({ classInfo: target });
    pointerDown(event, { subject: target, isNew: true });
  }
}

/* ---- keyboard ---- */
function onKeydown(event: KeyboardEvent) {
  // A layer above this one (palette, popover) that consumed the Escape
  // marks it defaultPrevented; one keypress closes one layer.
  if (event.defaultPrevented) {
    return;
  }
  if (event.key === "Escape" && !store.addingFromCard) {
    store.clearClassInfoStack();
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<style scoped>
/* Sized by its flex parent (the aside stack or the mobile sheet), not by
   height, so both containers can hand it their remaining space. */
.class-detail {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* ---------- viewed-class trail ---------- */
.detail-trail {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-3) var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--g-line);
  flex-shrink: 0;
}
.trail-path {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.trail-path::-webkit-scrollbar {
  display: none;
}
.trail-crumb {
  font: var(--text-id-small);
  color: var(--g-ink-3);
  background: transparent;
  border: none;
  padding: var(--space-05) var(--space-1);
  border-radius: var(--radius-xs);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.trail-crumb:hover {
  color: var(--g-accent);
  background: var(--g-accent-tint);
}
.trail-crumb:not(:last-child)::after {
  content: "›";
  color: var(--g-ink-3);
  margin-left: var(--space-1);
}
.trail-crumb.current {
  font-weight: 600;
  color: var(--g-ink);
  cursor: default;
}
.trail-crumb.current:hover {
  background: transparent;
  color: var(--g-ink);
}
.trail-close {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--g-ink-3);
  cursor: pointer;
  flex-shrink: 0;
}
.trail-close:hover {
  background: var(--g-surface-sunken);
  color: var(--g-ink);
}

/* ---------- body ---------- */
.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 var(--space-4) var(--space-8);
  min-height: 0;
}

/* Solid department color, the way legacy CourseRoad's own class-info
   card led with a colored header bar: identity is a color, not a
   hairline beside it. */
.detail-ident {
  background: var(--dept-color);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  margin: var(--space-2) 0;
}
.detail-id {
  font: var(--text-id-lg);
  margin: 0;
  color: var(--dept-on);
}
.detail-old-id {
  font-size: 0.55em;
  color: var(--dept-on-3);
  margin-left: var(--space-1);
}
.detail-title {
  font: var(--text-heading);
  color: var(--dept-on-2);
  margin: var(--space-1) 0 0;
}

/* One encoding: warn ink on the words, no tint behind them. */
.detail-alert {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
  color: var(--g-warn);
  margin: var(--space-3) 0 0;
}

.detail-onroad {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
  color: var(--g-ink-2);
  background: var(--g-surface-2);
  border: 1px solid var(--g-line);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  margin-top: var(--space-3);
  flex-wrap: wrap;
}
.onroad-action {
  font: var(--text-small);
  font-weight: 600;
  color: var(--g-accent);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: var(--space-05) var(--space-1);
  border-radius: var(--radius-xs);
}
.onroad-action:hover {
  background: var(--g-accent-tint);
}

/* ---------- stats ---------- */
/* One line of facts. The value carries mono weight and the unit stays quiet
   beside it. Space separates the pairs rather than a glyph, so a wrap never
   orphans a separator at the start of the second line. */
.detail-stats {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2) var(--space-4);
  margin: var(--space-3) 0 0;
  font: var(--text-id);
  color: var(--g-ink);
}
.stat {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
}
.stat a {
  display: inline-flex;
  align-items: center;
  gap: var(--space-05);
  color: inherit;
  text-decoration: none;
}
.stat a:hover {
  color: var(--g-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.stat .tone-heavy {
  color: var(--g-danger);
}
.stat .tone-light {
  color: var(--g-ok);
}
.stat-label {
  font: var(--text-small);
  color: var(--g-ink-3);
}
.detail-verdict {
  font: var(--text-small);
  margin: var(--space-2) 0 0;
  color: var(--g-ink-2);
}
/* The icon stays neutral even when the verdict is toned, so the tone reads
   as a property of the claim and not of the affordance beside it. */
.verdict-why {
  display: inline-flex;
  align-items: center;
  vertical-align: -2px;
  margin-left: var(--space-1);
  padding: 0;
  border: none;
  background: none;
  color: var(--g-ink-3);
  cursor: help;
  border-radius: var(--radius-full);
  transition: color var(--motion-quick) var(--ease-out);
}
.verdict-why:hover {
  color: var(--g-ink);
}
.verdict-why:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
.detail-verdict.tone-heavy {
  color: var(--g-danger);
}
.detail-verdict.tone-light {
  color: var(--g-ok);
}
.detail-note {
  font: var(--text-small);
  color: var(--g-ink-3);
  margin: var(--space-1) 0 0;
}
.repeat-note {
  font: var(--text-small);
  color: var(--g-ink-3);
  margin: 0 0 var(--space-2);
}

/* ---------- sections ---------- */
/* A link to another surface, not a call to action: no fill, no full width,
   no trailing arrow. */
.explore-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  font: var(--text-body);
  color: var(--g-ink-2);
  background: none;
  border: none;
  border-radius: var(--radius-xs);
  padding: var(--space-1) 0;
  cursor: pointer;
  transition: color var(--motion-quick) var(--ease-out);
}
.explore-link:hover {
  color: var(--g-accent);
}
.explore-link:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}

.detail-section {
  margin-top: var(--space-5);
}
.section-head {
  font: var(--text-heading);
  margin: 0 0 var(--space-2);
  color: var(--g-ink);
}
.head-ok {
  font: var(--text-small);
  color: var(--g-ok);
}
.inline-place {
  font: var(--text-small);
  color: var(--g-ink-3);
  background: none;
  border: none;
  padding: 0;
  margin-top: var(--space-3);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: var(--g-line-strong);
}
.inline-place:hover {
  color: var(--g-accent);
  text-decoration-color: var(--g-accent);
}
.either-note {
  font: var(--text-small);
  font-style: italic;
  color: var(--g-ink-3);
  margin: var(--space-2) 0;
  text-align: center;
}

.term-fit-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
.term-fit {
  display: inline-flex;
  align-items: center;
  font: var(--text-id-small);
  border: 1px solid var(--g-line-strong);
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
  background: var(--g-surface);
  color: var(--g-ink-2);
  transition:
    background-color var(--motion-quick) var(--ease-out),
    border-color var(--motion-quick) var(--ease-out);
}
.term-fit:hover:not(:disabled) {
  border-color: var(--g-ink-3);
}
.term-fit:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
/* "Offered" is the normal case, so it carries no color: the neutral base
   above is the whole treatment. Only the exceptions are marked, and each is
   marked once (tint alone, not tint plus border plus text). */
.term-fit.maybe,
.term-fit.no-longer-offered,
.term-fit.not-this-year {
  background: var(--g-warn-tint);
  border-color: transparent;
}
.term-fit.maybe:hover,
.term-fit.no-longer-offered:hover,
.term-fit.not-this-year:hover {
  border-color: var(--g-warn);
}
.term-fit.unavailable {
  background: var(--g-surface-sunken);
  border-color: transparent;
  color: var(--g-ink-disabled);
  cursor: default;
}

/* ---------- chips ---------- */
.chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
/* Solid department color, not a rail beside it (see tokens.css → course
   chips). */
.subject-chip {
  display: inline-flex;
  align-items: center;
  font: var(--text-id-small);
  color: var(--dept-on);
  height: 22px;
  background: var(--dept-color, var(--g-line-strong));
  border: none;
  border-radius: var(--radius-sm);
  padding: 0 var(--space-2);
  cursor: pointer;
  transition: box-shadow var(--motion-quick) var(--ease-out);
}
.subject-chip:hover {
  box-shadow: 0 0 0 1.5px var(--g-accent);
}
/* "+N more" names no subject, so it carries no department color. */
.subject-chip.more {
  background: var(--g-surface-2);
  color: var(--g-ink-3);
}
.subject-chip.more:hover {
  box-shadow: none;
  background: var(--g-surface-sunken);
}

/* ---------- facts ---------- */
.facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-1) var(--space-3);
  margin: 0 0 var(--space-3);
}
.facts dt {
  font: var(--text-small);
  color: var(--g-ink-3);
  align-self: baseline;
}
.facts dd {
  font: var(--text-small);
  color: var(--g-ink-2);
  margin: 0;
}
.detail-desc {
  font: var(--text-body);
  color: var(--g-ink-2);
  margin: 0 0 var(--space-3);
}
.external-links {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.external-links a {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font: var(--text-small);
  color: var(--g-accent);
  text-decoration: none;
}
</style>
