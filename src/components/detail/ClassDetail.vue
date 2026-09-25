<template>
  <div
    v-if="subject"
    id="classInfoCard"
    class="class-detail"
    data-cy="classInfoCard"
  >
    <!-- viewed-class trail -->
    <div class="detail-trail">
      <g-button
        :disabled="activeIndex <= 0"
        variant="ghost"
        size="xs"
        icon-only
        data-cy="classInfoBackButton"
        :aria-label="
          activeIndex > 0 ? `Back to ${trail[activeIndex - 1]}` : 'Back'
        "
        @click="store.setActiveClass(activeIndex - 1)"
      >
        <g-icon name="back" :size="14" />
      </g-button>
      <g-button
        :disabled="activeIndex >= trail.length - 1"
        variant="ghost"
        size="xs"
        icon-only
        data-cy="classInfoForwardButton"
        :aria-label="
          activeIndex < trail.length - 1
            ? `Forward to ${trail[activeIndex + 1]}`
            : 'Forward'
        "
        @click="store.setActiveClass(activeIndex + 1)"
      >
        <g-icon name="forward" :size="14" />
      </g-button>
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
      <g-button
        variant="ghost"
        size="xs"
        icon-only
        class="trail-close"
        aria-label="Close panel"
        data-cy="closeClassInfoButton"
        @click="store.clearClassInfoStack()"
      >
        <g-icon name="close" :size="13" />
      </g-button>
    </div>

    <div
      ref="bodyEl"
      class="detail-body"
      tabindex="-1"
      role="group"
      aria-labelledby="classInfoTitle"
      data-cy="classInfoBody"
    >
      <!-- identity -->
      <div
        class="detail-ident"
        :style="{ '--dept-color': courseColor(subject) }"
      >
        <h2 id="classInfoTitle" class="detail-id">
          {{ subject.subject_id
          }}<sub v-if="subject.old_id" class="detail-old-id"
            >[{{ subject.old_id }}]</sub
          >
        </h2>
        <p class="detail-title" data-cy="cardSubjectTitle">
          {{ subject.title }}
        </p>
        <g-tooltip
          class="favorite-toggle-wrap"
          :text="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
        >
          <g-button
            variant="ghost"
            size="sm"
            icon-only
            class="favorite-toggle"
            data-cy="favoriteToggle"
            :aria-label="`Favorite ${subject.subject_id}`"
            :aria-pressed="isFavorite"
            @click="favorites.toggleFavorite(subject.subject_id)"
          >
            <g-icon name="star" :size="16" />
          </g-button>
        </g-tooltip>
      </div>

      <!-- alerts -->
      <p v-if="subject.is_historical" class="detail-alert">
        <g-icon name="warn" :size="13" />
        No longer offered. Last offered
        {{ (subject.source_semester ?? "").split("-").join(" ") }}.
      </p>
      <p v-else-if="subject.not_offered_year" class="detail-alert">
        <g-icon name="warn" :size="13" />
        Not offered in the {{ subject.not_offered_year }} school year.
      </p>

      <!-- on the road? -->
      <div v-if="onRoadBucket >= 0" class="detail-onroad">
        <span>
          On your road: <strong>{{ bucketName(onRoadBucket) }}</strong>
        </span>
        <g-button variant="link" size="sm" @click="jumpToBucket(onRoadBucket)">
          Go to it
        </g-button>
        <g-button variant="link" size="sm" @click="moveIt">Move it</g-button>
      </div>
      <p v-if="subjectNote !== undefined" class="detail-own-note">
        <g-icon name="message" :size="12" class="detail-own-note-icon" />
        <span><span class="sr-only">Your note: </span>{{ subjectNote }}</span>
      </p>

      <!-- stats -->
      <p class="detail-stats">
        <span
          v-if="subject.rating !== undefined"
          class="stat"
          data-cy="cardRating"
        >
          <g-link
            :href="evaluationsUrl"
            tone="quiet"
            external
            hide-external-mark
            :aria-label="`Rated ${subject.rating.toFixed(1)} of 7 in subject evaluations (opens in a new tab)`"
            ><g-icon name="star" :size="11" class="stat-icon" />
            {{ subject.rating.toFixed(1) }}</g-link
          ><span class="stat-label" aria-hidden="true">/7</span>
        </span>
        <span v-if="totalHours !== null" class="stat" data-cy="cardHours">
          <span :class="hoursTone">{{ totalHours.toFixed(1) }}</span>
          <span class="stat-label" aria-hidden="true"
            >h/wk{{ isGeneric ? "*" : "" }}</span
          ><span class="sr-only"
            >hours per week{{ isGeneric ? ", averaged (see note)" : "" }}</span
          >
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
          <span class="stat-label">avg enroll</span>
        </span>
      </p>
      <p v-if="hoursVerdict" class="detail-verdict" :class="hoursTone">
        {{ hoursVerdict }}
        <g-tooltip wide placement="bottom">
          <button
            class="verdict-why g-hit"
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
      <g-button
        v-if="inCatalog && !isMobile"
        variant="quiet"
        class="explore-link"
        data-cy="exploreFromDetail"
        @click="exploreFromHere"
      >
        <g-icon name="graph" :size="14" />
        Show in Connections
      </g-button>
      <div class="external-links">
        <g-button
          v-if="subject.url"
          size="sm"
          :href="safeHref(subject.url)"
          external
        >
          Catalog <g-icon name="external" :size="12" class="link-out" />
        </g-button>
        <g-button v-if="inCatalog" size="sm" :href="evaluationsUrl" external>
          Evaluations <g-icon name="external" :size="12" class="link-out" />
        </g-button>
        <g-button v-if="inCatalog" size="sm" :href="openGradesUrl" external>
          OpenGrades <g-icon name="external" :size="12" class="link-out" />
        </g-button>
      </div>

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
        <div
          class="term-fit-grid"
          :class="{ 'no-iap': store.hideIAP }"
          data-cy="cardOffered"
        >
          <button
            v-for="fit in termFits"
            :key="fit.index"
            class="term-fit"
            :class="fit.kind"
            :style="{ gridColumn: fit.column }"
            :title="fit.hint"
            :aria-label="`${fit.label}: ${fit.hint}`"
            @click="placeInTerm(fit.index)"
          >
            <!-- The tint marks an uncertain term; the icon says it without
                 relying on color. -->
            <g-icon
              v-if="fit.kind !== 'ok'"
              name="notice"
              :size="11"
              class="term-fit-mark"
            />
            {{ fit.label }}
          </button>
        </div>
        <g-button
          variant="quiet"
          size="sm"
          class="inline-place"
          data-cy="addClassFromCardButton"
          @click="store.addFromCard(subject)"
        >
          Or place it on your road
        </g-button>
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
          <template v-if="levelSummary">
            <dt>Level</dt>
            <dd>{{ levelSummary }}</dd>
          </template>
          <template v-if="offeredParts.length">
            <dt>Offered</dt>
            <dd>
              <template v-for="(part, i) in offeredParts" :key="part">
                <span v-if="i > 0">, </span>
                {{ part }}
              </template>
            </dd>
          </template>
        </dl>
        <p class="detail-desc" data-cy="cardDescription">
          {{ subject.description }}
        </p>
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
  useTemplateRef,
} from "vue";
import { useRouter } from "vue-router";
import GButton from "../../design/components/GButton.vue";
import GLink from "../../design/components/GLink.vue";
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
import { useFavoritesStore } from "../../stores/favorites";
import { useNotesStore } from "../../stores/notes";
import { pointerDown } from "../../stores/dragdrop";

const store = useCourseDataStore();
const router = useRouter();
const bodyEl = useTemplateRef("bodyEl");
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
const trailPathEl = useTemplateRef("trailPathEl");
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

/** Favorites: listed first in the command palette. */
const favorites = useFavoritesStore();
const isFavorite = computed(
  () =>
    subject.value !== undefined &&
    favorites.isFavorite(subject.value.subject_id),
);

/** The student's own note on this subject (FireRoad keeps one per id). */
const notesStore = useNotesStore();
const subjectNote = computed(() =>
  subject.value === undefined
    ? undefined
    : notesStore.noteFor(subject.value.subject_id),
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
  /** Grid column by semester, so a column always means the same term. */
  column: number;
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
    const column =
      season === "Fall" ? 1 : season === "IAP" ? 2 : store.hideIAP ? 2 : 3;
    fits.push({
      index: i,
      label: `${season} ’${semesterCalendarYearShort(i, base)}`,
      kind,
      column,
      hint:
        kind === "ok"
          ? `Offered. Add to ${bucketName(i)}`
          : kind === "unavailable"
            ? "Not offered this term. Add anyway"
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
 * Hours relative to the units norm (1 unit ≈ 1 h/week), ±35% band.
 * Evaluation hours run systematically below the nominal count, so a
 * tighter floor marks the norm rather than an exception. Keep these
 * thresholds algebraically identical to `hoursVerdict` below (ratio ≥
 * 1.35 == diff ≥ 0.35×units) so the tint and the sentence agree.
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

  if (units === 0) {
    return null;
  }

  const diff = totalHours.value - units;
  const singular =
    units === 1
      ? { unit: "unit", suggest: "suggests" }
      : { unit: "units", suggest: "suggest" };
  if (diff >= 0.35 * units) {
    return `May be heavier than its ${units} ${singular.unit} ${singular.suggest}.`;
  }
  if (diff <= -0.35 * units) {
    return `May be lighter than its ${units} ${singular.unit} ${singular.suggest}.`;
  }
  return null;
});

/**
 * MIT counts a unit as an hour of work a week; the line appears when
 * evaluation hours disagree with that by more than the `hoursVerdict`
 * thresholds.
 */
const hoursExplainer = computed(() => {
  const s = subject.value;
  if (s?.total_units === undefined || totalHours.value === null) {
    return "";
  }
  const hours = totalHours.value.toFixed(1);
  const reported = isGeneric.value
    ? `Subject evaluations put ${s.subject_id} subjects at ${hours}h of work per week on average.`
    : `Subject evaluations put this subject at ${hours}h of work per week.`;
  return `One unit is approximately 14 hours of work over a single term, or approximately one hour of work per week. ${reported}`;
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

const levelSummary = computed(() => {
  const s = subject.value;
  if (s === undefined || s.level === undefined) {
    return "";
  }
  switch (s.level) {
    case "U":
      return "Undergraduate";
    case "G":
      return "Graduate";
    default:
      return "";
  }
});

const offeredParts = computed(() => {
  const s = subject.value;
  if (s === undefined) {
    return [];
  }
  const terms = [
    s.offered_fall ? "Fall" : null,
    s.offered_IAP ? "IAP" : null,
    s.offered_spring ? "Spring" : null,
    s.offered_summer ? "Summer" : null,
  ].filter((t): t is string => t !== null);
  return terms.length ? terms : ["no scheduled terms"];
});

// Subject ids are encoded: a custom activity's id is user-typed and an
// import can carry any string, so an unencoded value could inject query
// parameters on another site.
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
      label: "Meets with",
      dataCy: "cardMeetsWithSubjects",
      subjects: resolve(s.meets_with_subjects),
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

/* The panel covers the audit, so focus has to come with it: without this
   the click leaves focus on a row that is now inert. A new class also
   replaces the shown one without a remount, and the control that chose
   it may leave with the old class, such as a prerequisite chip. Focus
   that is still live, such as a canvas card the student clicked, stays
   where it is, and below 860px the sheet's own focus trap moves focus in
   and back out. Focus lands on the scrolling body, not the panel root,
   so Space, PageDown and the arrows still scroll it. */
function takeStrandedFocus() {
  const active = document.activeElement;
  const stranded =
    active === null ||
    active === document.body ||
    active.closest("[inert]") !== null;
  if (stranded && !isMobile.value) {
    bodyEl.value?.focus({ preventScroll: true });
  }
}
onMounted(takeStrandedFocus);
// Keyed on the shown id, not the subject object, so a catalog refetch
// that swaps the object leaves focus alone.
watch(
  () => store.classInfoStack[store.activeClassIndex],
  () => void nextTick(takeStrandedFocus),
);
</script>

<style scoped>
/* Sized by its container, not by height: the aside's stack insets it
   over the audit, and the mobile sheet hands it its remaining space. */
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
  flex-shrink: 0;
}

/* ---------- body ---------- */
.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 var(--space-4) var(--space-8);
  min-height: 0;
}
/* The body takes focus on open, and a click inside it lands here too, so
   the keyboard scrolls what it should. A keyboard open shows where focus
   landed, with the ring drawn inside because the panel is flush with the
   aside's clipped edges; a click shows no ring. */
.detail-body:focus {
  outline: none;
}
.detail-body:focus-visible {
  box-shadow: var(--g-focus-ring-inset);
}

/* Solid department color header bar. */
.detail-ident {
  position: relative;
  background: var(--dept-color);
  border-radius: var(--radius-md);
  /* room on the right for the favorite star */
  padding: var(--space-2) var(--space-10) var(--space-2) var(--space-3);
  margin: var(--space-2) 0;
}
.detail-ident :deep(.favorite-toggle-wrap) {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
}
.detail-ident .favorite-toggle {
  color: var(--dept-on);
}
.detail-ident .favorite-toggle:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dept-on) 16%, transparent);
  color: var(--dept-on);
}
.detail-ident .favorite-toggle:active:not(:disabled) {
  background: color-mix(in srgb, var(--dept-on) 24%, transparent);
}
.favorite-toggle[aria-pressed="true"] :deep(path) {
  fill: currentColor;
}
.detail-id {
  font: var(--text-id-lg);
  margin: 0;
  color: var(--dept-on);
  font-weight: 700;
}
.detail-old-id {
  font: var(--text-id-small);
  color: var(--dept-on-3);
}
.detail-title {
  font: var(--text-heading);
  color: var(--dept-on-2);
  margin: var(--space-1) 0 0;
}

/* warn ink on the words, no tint behind them */
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
  gap: var(--space-2) var(--space-3);
  font: var(--text-small);
  color: var(--g-ink-2);
  background: var(--g-surface-2);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  margin-top: var(--space-3);
  flex-wrap: wrap;
}
.detail-own-note {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font: var(--text-small);
  color: var(--g-ink);
  background: var(--g-surface-2);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  margin: var(--space-3) 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.detail-own-note-icon {
  color: var(--g-ink-3);
  margin-top: 2px;
  flex-shrink: 0;
}

/* ---------- stats ---------- */
/* One line of facts. Space separates the pairs rather than a glyph, so a
   wrap never orphans a separator. */
.detail-stats {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2) var(--space-4);
  margin: var(--space-3) 0 0;
  font: var(--text-id);
  font-variant-numeric: tabular-nums;
  color: var(--g-ink);
}
.stat {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-05);
}
/* the number gives the link its baseline, so it lines up with "/7"; the
   star just rides centered beside it */
.stat-icon {
  align-self: center;
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
/* The icon stays neutral even when the verdict is toned. */
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
.explore-link,
.inline-place {
  margin-top: var(--space-3);
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
.either-note {
  font: var(--text-small);
  font-style: italic;
  color: var(--g-ink-3);
  margin: var(--space-2) 0;
  text-align: center;
}

.term-fit-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-1);
}
.term-fit-grid.no-iap {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.term-fit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  font: var(--text-small);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
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
.term-fit:hover {
  border-color: var(--g-ink-3);
}
.term-fit-mark {
  margin-right: 3px;
  color: var(--g-warn);
}
.term-fit:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
/* Offered is the normal case and carries no color; only the exceptions
   are marked, once. */
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
  background: var(--g-danger-tint);
  border-color: transparent;
}
.term-fit.unavailable .term-fit-mark {
  color: var(--g-danger);
}
.term-fit.unavailable:hover {
  border-color: var(--g-danger);
}

/* ---------- chips ---------- */
.chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
/* Solid department color (see tokens.css, course chips). */
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
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-3);
}
/* the one glyph that says "leaves the app" carries the notice hue */
.link-out {
  color: var(--g-info);
}
</style>
