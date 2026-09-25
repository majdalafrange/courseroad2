<template>
  <g-sheet
    :model-value="modelValue"
    label="Search classes and commands"
    width="640px"
    placement="top"
    :close-button="false"
    initial-focus=".palette-input"
    class="palette"
    @update:model-value="emit('update:modelValue', $event)"
    @close-auto-focus="onCloseAutoFocus"
  >
    <g-combobox-root
      ref="comboRoot"
      class="palette-combobox"
      @highlight="highlighted = $event"
      @keydown.capture="onKeydownCapture"
      @pointerdown.capture="lastInput = 'pointer'"
    >
      <div class="palette-input-row">
        <g-icon name="search" :size="16" class="palette-search-icon" />
        <div class="palette-tokens">
          <button
            v-for="token in activeTokens"
            :key="token.key"
            type="button"
            class="token-chip"
            :aria-label="`Remove filter ${token.label}`"
            @click="removeToken(token.key)"
          >
            {{ token.label }}
            <g-icon name="close" :size="9" />
          </button>
          <g-combobox-input
            ref="inputEl"
            v-model="query"
            class="palette-input"
            data-cy="classSearchInput"
            placeholder="Search classes, filters, commands..."
            aria-label="Search classes, filters, and commands"
            aria-describedby="paletteHelp"
            spellcheck="false"
            @keydown="onInputKeydown"
          />
        </div>
        <g-kbd class="palette-kbd" :keys="['esc']" aria-hidden="true" />
      </div>
      <span id="paletteHelp" hidden>
        Up and down arrows move through the results. Enter opens a class or runs
        a command; Tab places the class on your road.
      </span>
      <div class="sr-only" role="status">{{ resultSummary }}</div>

      <div v-if="tokenSuggestions.length" class="token-suggest-row">
        <span class="token-suggest-label">Filters:</span>
        <g-chip
          v-for="suggestion in tokenSuggestions"
          :key="suggestion.key"
          interactive
          @click="addToken(suggestion.key)"
        >
          {{ suggestion.label }}
        </g-chip>
      </div>

      <g-combobox-list label="Results" class="palette-list" @escape="onEscape">
        <!-- favorites, first, before any search (empty query, no filter) -->
        <g-combobox-group
          v-if="favoriteSubjects.length"
          label-class="palette-section"
        >
          <template #label>Favorites</template>
          <palette-class-row
            v-for="subject in favoriteSubjects"
            :key="subject.subject_id"
            :subject="subject"
            :value="`favorite:${subject.subject_id}`"
            :highlighted="highlighted === `favorite:${subject.subject_id}`"
            :data-cy="'favoriteInSearch' + subject.subject_id.replace('.', '_')"
            @pointerdown="rowPointerDown($event, subject)"
            @select="onClassSelect(subject)"
          />
        </g-combobox-group>

        <!-- requirement-aware suggestions (empty query only) -->
        <g-combobox-group
          v-if="showAuditSuggestions"
          label-class="palette-section"
        >
          <template #label>From your audit</template>
          <g-combobox-item
            v-for="suggestion in auditSuggestions"
            :key="suggestion.label"
            :value="`audit:${suggestion.label}`"
            class="palette-row suggestion-row"
            @select="applyAuditSuggestion(suggestion)"
          >
            <span class="row-icon ok">
              <g-icon name="check" :size="14" />
            </span>
            <span class="row-main">
              <span class="row-title">{{ suggestion.label }}</span>
              <span class="row-sub">{{ suggestion.detail }}</span>
            </span>
          </g-combobox-item>
        </g-combobox-group>

        <!-- classes -->
        <g-combobox-group
          v-if="classResults.length"
          label-class="palette-section"
        >
          <template #label>
            Classes
            <span v-if="resultOverflow > 0" class="section-note">
              (showing {{ classResults.length }} of
              {{ classResults.length + resultOverflow }}, keep typing)
            </span>
          </template>
          <palette-class-row
            v-for="subject in classResults"
            :key="subject.subject_id"
            :subject="subject"
            :value="`class:${subject.subject_id}`"
            :highlighted="highlighted === `class:${subject.subject_id}`"
            :data-cy="'classInSearch' + subject.subject_id.replace('.', '_')"
            @pointerdown="rowPointerDown($event, subject)"
            @select="onClassSelect(subject)"
          />
        </g-combobox-group>

        <!-- actions -->
        <g-combobox-group
          v-if="actionResults.length"
          label-class="palette-section"
        >
          <template #label>Actions</template>
          <g-combobox-item
            v-for="action in actionResults"
            :key="action.label"
            :value="`action:${action.label}`"
            class="palette-row action-row"
            @select="runAction(action)"
          >
            <span class="row-icon">
              <g-icon :name="action.icon" :size="14" />
            </span>
            <span class="row-main">
              <span class="row-title">{{ action.label }}</span>
              <span v-if="action.detail" class="row-sub">{{
                action.detail
              }}</span>
            </span>
          </g-combobox-item>
        </g-combobox-group>

        <div
          v-if="
            !classResults.length &&
            !actionResults.length &&
            !showAuditSuggestions
          "
          class="palette-empty"
        >
          Nothing matches.<template v-if="tokenSuggestions.length">
            <g-kbd :keys="['Tab']" /> applies the suggested filter.</template
          >
        </div>
      </g-combobox-list>

      <!-- The filter grammar's one line of documentation. A footer rather
           than part of the empty state: with an empty query the base
           actions always render, so an empty-state hint could never
           appear. -->
      <div
        v-if="!query.length && !hasActiveFilters"
        class="palette-hint"
        data-cy="paletteGrammarHint"
      >
        Type to search {{ catalogSize }} subjects, or compose filters:
        <code>hass-a</code> then <g-kbd :keys="['Tab']" />,
        <code>spring</code> then <g-kbd :keys="['Tab']" />.
      </div>
    </g-combobox-root>
  </g-sheet>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  useTemplateRef,
  watch,
} from "vue";
import {
  GComboboxGroup,
  GComboboxInput,
  GComboboxItem,
  GComboboxList,
  GComboboxRoot,
} from "../../design/components/GCombobox";
import GChip from "../../design/components/GChip.vue";
import GIcon, { type IconName } from "../../design/components/GIcon.vue";
import GKbd from "../../design/components/GKbd.vue";
import GSheet from "../../design/components/GSheet.vue";
import { useIsMobile } from "../../composables/useIsMobile";
import {
  chosenFiltersFor,
  TOKEN_DEFS,
  type TokenDef,
} from "../../lib/paletteTokens";
import { SearchIndex } from "../../lib/search";
import { sortCoursesList } from "../../lib/audit";
import { openAttributeGaps } from "../../lib/suggestions";
import type { Subject } from "../../lib/types";
import { useAuditStore } from "../../stores/audit";
import { useCourseDataStore } from "../../stores/courseData";
import { useFavoritesStore } from "../../stores/favorites";
import PaletteClassRow from "./PaletteClassRow.vue";
import { getSubject } from "../../lib/types";
import { pointerDown } from "../../stores/dragdrop";
import { history } from "../../stores/history";

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "action", name: string, payload?: string): void;
}>();

const store = useCourseDataStore();
const auditStore = useAuditStore();
const isMobile = useIsMobile();

const inputEl = useTemplateRef("inputEl");
const comboRoot = useTemplateRef("comboRoot");
const query = ref("");

/* ------------------------------------------------------------- tokens */

const activeTokenKeys = ref<string[]>([]);

const activeTokens = computed(() =>
  activeTokenKeys.value
    .map((key) => TOKEN_DEFS.find((t) => t.key === key))
    .filter((t): t is TokenDef => t !== undefined),
);

const chosenFilters = computed(() => chosenFiltersFor(activeTokens.value));

const hasActiveFilters = computed(() => activeTokenKeys.value.length > 0);

function addToken(key: string) {
  if (!activeTokenKeys.value.includes(key)) {
    activeTokenKeys.value.push(key);
  }
  // strip the matched word from the query
  const word = currentWord.value.toLowerCase();
  if (word.length) {
    const def = TOKEN_DEFS.find((t) => t.key === key);
    if (def?.aliases.some((a) => a.startsWith(word))) {
      query.value = query.value
        .slice(0, query.value.length - currentWord.value.length)
        .trimEnd();
    }
  }
  inputEl.value?.focus();
}

function removeToken(key: string) {
  activeTokenKeys.value = activeTokenKeys.value.filter((k) => k !== key);
  inputEl.value?.focus();
}

const currentWord = computed(() => {
  const parts = query.value.split(/\s+/);
  return parts[parts.length - 1] ?? "";
});

const tokenSuggestions = computed(() => {
  const word = currentWord.value.toLowerCase();
  if (word.length < 2) {
    return [];
  }
  return TOKEN_DEFS.filter(
    (t) =>
      !activeTokenKeys.value.includes(t.key) &&
      t.aliases.some((a) => a.startsWith(word)),
  ).slice(0, 5);
});

/* ------------------------------------------------------------- search */

const searchIndex = new SearchIndex();

const allSubjects = computed(() =>
  (store.genericCourses as Subject[]).concat(store.subjectsInfo as Subject[]),
);

watch(allSubjects, (subjects) => searchIndex.setSubjects(subjects), {
  immediate: true,
});

const catalogSize = computed(() => allSubjects.value.length);

const MAX_RESULTS = 50;

const fullResults = computed(() => {
  void allSubjects.value.length; // reactive dep on catalog updates
  return searchIndex.search(query.value.trim(), chosenFilters.value);
});

const classResults = computed(() => fullResults.value.slice(0, MAX_RESULTS));
const resultOverflow = computed(() =>
  Math.max(0, fullResults.value.length - MAX_RESULTS),
);

/* ------------------------------------------------------------- actions */

interface PaletteAction {
  label: string;
  detail?: string;
  icon: IconName;
  keywords: string;
  run: () => void;
}

const baseActions = computed<PaletteAction[]>(() => {
  const actions: PaletteAction[] = [
    {
      label: "Settings",
      detail: "Theme and panel side",
      icon: "settings",
      keywords: "theme dark light mode switch settings preferences system",
      run: () => emit("action", "open-settings"),
    },
    {
      label: "New road",
      icon: "plus",
      keywords: "new road create plan",
      run: () => emit("action", "create-road"),
    },
    {
      label: "New custom activity",
      detail: "Cross-registered subjects, PE, etc.",
      icon: "pencil",
      keywords: "custom activity urop create new class",
      run: () => emit("action", "new-custom-activity"),
    },
    {
      label: "Import a road",
      icon: "import",
      keywords: "import road file upload",
      run: () => emit("action", "open-import"),
    },
    {
      label: "Export this road",
      icon: "download",
      keywords: "export road file download save",
      run: () => emit("action", "export-road"),
    },
    {
      label: "About CourseRoad",
      icon: "info",
      keywords: "about help info credits",
      run: () => emit("action", "open-about"),
    },
  ];
  if (history.canUndo) {
    actions.unshift({
      label: `Undo: ${history.undoLabel}`,
      icon: "undo",
      keywords: "undo revert back",
      run: () => emit("action", "undo"),
    });
  }
  if (history.canRedo) {
    actions.unshift({
      label: `Redo: ${history.redoLabel}`,
      icon: "redo",
      keywords: "redo again forward",
      run: () => emit("action", "redo"),
    });
  }
  // The graph is not offered on mobile: it can grow heavy enough to slow
  // or crash the browser there.
  if (!isMobile.value) {
    actions.push({
      label: "Explore connections",
      detail: "See which subjects connect to the ones on your road",
      icon: "graph",
      keywords: "explore connections graph discover related crossings",
      run: () => emit("action", "open-explore"),
    });
  }
  // jump to roads
  for (const [roadID, road] of Object.entries(store.roads)) {
    if (roadID !== store.activeRoad) {
      actions.push({
        label: `Go to road: ${road.name}`,
        icon: "map",
        keywords: `road switch go ${road.name.toLowerCase()}`,
        run: () => emit("action", "switch-road", roadID),
      });
    }
  }
  return actions;
});

const programActions = computed<PaletteAction[]>(() => {
  if (query.value.trim().length < 2) {
    return [];
  }
  const selected = store.roads[store.activeRoad]?.contents.coursesOfStudy ?? [];
  return sortCoursesList(auditStore.reqList)
    .filter((entry) => !selected.includes(entry.key))
    .filter((entry) =>
      entry["medium-title"]
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()),
    )
    .slice(0, 4)
    .map((entry) => ({
      label: `Add program: ${entry["medium-title"]}`,
      icon: "check",
      keywords: "",
      // runAction() keeps the palette open after this action so several
      // programs can be added in one go.
      run: () => {
        store.addReq(entry.key);
      },
    }));
});

const actionResults = computed<PaletteAction[]>(() => {
  const q = query.value.trim().toLowerCase();
  let matches: PaletteAction[];
  if (q.length === 0) {
    matches = hasActiveFilters.value ? [] : baseActions.value.slice(0, 4);
  } else {
    matches = baseActions.value.filter(
      (action) =>
        action.label.toLowerCase().includes(q) || action.keywords.includes(q),
    );
  }
  return [...matches, ...programActions.value].slice(0, 6);
});

function runAction(action: PaletteAction) {
  action.run();
  if (!action.label.startsWith("Add program")) {
    closeAfterAction();
  }
}

/* ----------------------------------------- requirement-aware suggestions */

interface AuditSuggestion {
  label: string;
  detail: string;
  tokens: string[];
}

const auditSuggestions = computed<AuditSuggestion[]>(() => {
  if (
    query.value.length > 0 ||
    hasActiveFilters.value ||
    !store.hasGIRReqList
  ) {
    return [];
  }
  const suggestions: AuditSuggestion[] = [];
  const nextSeason = store.currentSemester % 3 === 1 ? "spring" : "fall";
  const tokenFor: Record<string, string> = {
    "HASS-A": "hass-a",
    "HASS-S": "hass-s",
    "HASS-H": "hass-h",
    "HASS-E": "hass-e",
    "CI-H": "ci-h",
    "CI-HW": "ci-hw",
  };
  for (const req of openAttributeGaps(
    Object.values(auditStore.reqTrees),
  ).keys()) {
    const token = tokenFor[req];
    if (token === undefined) {
      continue;
    }
    suggestions.push({
      label: `${req} still needed`,
      detail: `Show ${req} subjects offered in the ${nextSeason}`,
      tokens: [token, nextSeason],
    });
    if (suggestions.length >= 3) {
      break;
    }
  }
  return suggestions;
});

const showAuditSuggestions = computed(
  () => auditSuggestions.value.length > 0 && query.value.length === 0,
);

function applyAuditSuggestion(suggestion: AuditSuggestion) {
  for (const token of suggestion.tokens) {
    if (!activeTokenKeys.value.includes(token)) {
      activeTokenKeys.value.push(token);
    }
  }
  inputEl.value?.focus();
}

/* ------------------------------------------------------- selection model */

// The highlighted item's value ("class:6.006", "action:...", "audit:..."),
// from the combobox. It is the input's aria-activedescendant.
const highlighted = ref<string | undefined>(undefined);

const totalCount = computed(
  () =>
    favoriteSubjects.value.length +
    (showAuditSuggestions.value ? auditSuggestions.value.length : 0) +
    classResults.value.length +
    actionResults.value.length,
);

// New results under the input: highlight the first again, as typing does.
watch(
  [query, activeTokenKeys],
  () => {
    void nextTick(() => comboRoot.value?.highlightFirst());
  },
  { deep: true },
);

/* ---- favorites: the student's list, before any search ---- */
const favoritesStore = useFavoritesStore();
const favoriteSubjects = computed<Subject[]>(() => {
  if (query.value.length > 0 || hasActiveFilters.value) {
    return [];
  }
  // A favorite the catalog no longer has (or hasn't loaded yet) is skipped.
  return favoritesStore.ids
    .map((id) => getSubject(store.catalog, id))
    .filter((subject): subject is Subject => subject !== undefined);
});

function highlightedClass(): Subject | undefined {
  const value = highlighted.value ?? "";
  const [kind, id] = [
    value.slice(0, value.indexOf(":")),
    value.slice(value.indexOf(":") + 1),
  ];
  const list =
    kind === "class"
      ? classResults.value
      : kind === "favorite"
        ? favoriteSubjects.value
        : [];
  return list.find((subject) => subject.subject_id === id);
}

/* Enter opens a class, a click places it. The combobox chooses on Enter
   by clicking the highlighted item, so the choice itself can't say which
   it was; the last key or pointer press does. */
const lastInput = ref<"keyboard" | "pointer">("keyboard");

function onKeydownCapture(event: KeyboardEvent) {
  lastInput.value = "keyboard";
  // The open shortcut closes it again (the global listener stands aside
  // inside a dialog).
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    dismiss();
  }
}

function onClassSelect(subject: Subject) {
  if (lastInput.value === "keyboard") {
    openClass(subject);
  } else {
    placeClass(subject);
  }
}

function onInputKeydown(event: KeyboardEvent) {
  if (event.key === "Backspace" && query.value === "") {
    activeTokenKeys.value.pop();
    return;
  }
  // Tab completes a filter or places the highlighted class. Only when
  // there is one to act on, and never Shift+Tab: otherwise Tab moves focus
  // as usual, to the filter chips and suggestions around the input. A
  // consumed Tab stops here, or the dialog's focus trap would move focus
  // on the same keypress.
  if (event.key === "Tab" && !event.shiftKey) {
    if (tokenSuggestions.value.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      addToken(tokenSuggestions.value[0].key);
      return;
    }
    const subject = highlightedClass();
    if (subject !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      placeClass(subject);
    }
  }
}

/**
 * Escape closes the palette from anywhere inside it. The result list is
 * the top dismissable layer, so it gets the keypress; marking it consumed
 * keeps ClassDetail's and RoadCanvas's window listeners off it: one
 * Escape, one layer.
 */
function onEscape(event: KeyboardEvent) {
  event.preventDefault();
  dismiss();
}

/* ---- result count, spoken: settles for a beat so typing isn't read
   letter by letter ---- */
const resultSummary = ref("");
let summaryTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  [() => props.modelValue, totalCount, query, activeTokenKeys],
  () => {
    clearTimeout(summaryTimer);
    if (!props.modelValue) {
      resultSummary.value = "";
      return;
    }
    summaryTimer = setTimeout(() => {
      resultSummary.value = describeResults();
    }, 500);
  },
  { deep: true },
);
onBeforeUnmount(() => clearTimeout(summaryTimer));

function describeResults(): string {
  const favorites = favoriteSubjects.value.length;
  if (favorites > 0 || showAuditSuggestions.value) {
    const parts: string[] = [];
    if (favorites > 0) {
      parts.push(`${favorites} ${favorites === 1 ? "favorite" : "favorites"}`);
    }
    if (showAuditSuggestions.value) {
      parts.push(
        `${auditSuggestions.value.length} suggestions from your audit`,
      );
    }
    return parts.join(", ");
  }
  const classes = classResults.value.length;
  const actions = actionResults.value.length;
  if (classes === 0 && actions === 0) {
    return "No results";
  }
  const parts: string[] = [];
  if (classes > 0) {
    parts.push(
      resultOverflow.value > 0
        ? `${classes + resultOverflow.value} classes, showing ${classes}`
        : `${classes} ${classes === 1 ? "class" : "classes"}`,
    );
  }
  if (actions > 0) {
    parts.push(`${actions} ${actions === 1 ? "command" : "commands"}`);
  }
  return parts.join(", ");
}

/* ------------------------------------------------------------ behaviors */

/* Click and Tab arm canvas placement; Enter opens the detail. The
   pointerdown that precedes every click runs dragStartClass first, which
   presets itemAdding with the same subject and addingFromCard false, so
   the addFromCard here overwrites rather than double-arms. */

function openClass(subject: Subject) {
  // Let go of the input before the detail opens, so focus is stranded
  // and the detail takes it (see ClassDetail's takeStrandedFocus).
  inputEl.value?.blur();
  store.pushClassStack(subject.subject_id);
  closeAfterAction();
}

function placeClass(subject: Subject) {
  store.addFromCard(subject);
  closeAfterAction();
}

function rowPointerDown(event: PointerEvent, subject: Subject) {
  store.dragStartClass({ classInfo: subject });
  pointerDown(event, { subject, isNew: true });
}

/* ---- closing and focus return ----
   The dialog puts focus back where it came from when the palette is
   dismissed (Escape, the scrim, the shortcut). After opening a class,
   placing one, or running a command, focus belongs to whatever that
   opened, so the return is skipped. */
let returnFocus = true;

function dismiss() {
  returnFocus = true;
  emit("update:modelValue", false);
}

function closeAfterAction() {
  returnFocus = false;
  emit("update:modelValue", false);
}

function onCloseAutoFocus(event: Event) {
  if (!returnFocus) {
    event.preventDefault();
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      returnFocus = true;
      lastInput.value = "keyboard";
      query.value = "";
      activeTokenKeys.value = [];
    }
  },
);

defineExpose({
  openWithTokens: (tokens: string[]) => {
    emit("update:modelValue", true);
    void nextTick(() => {
      activeTokenKeys.value = [...tokens];
      inputEl.value?.focus();
    });
  },
  openWithQuery: (text: string) => {
    emit("update:modelValue", true);
    void nextTick(() => {
      query.value = text;
      inputEl.value?.focus();
      inputEl.value?.select();
    });
  },
});
</script>

<style>
/* Not scoped: the panel is GSheet's, teleported by Reka, and the rows
   are Reka's elements; every rule is under .palette (the panel's class)
   instead. */
.palette-combobox {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.palette .palette-input-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--g-line);
}
.palette .palette-search-icon {
  color: var(--g-ink-3);
}
.palette .palette-tokens {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  min-width: 0;
}
.palette .token-chip {
  /* 24px: the minimum target size (WCAG 2.5.8) */
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font: var(--text-small);
  font-weight: 600;
  color: var(--g-on-accent);
  background: var(--g-accent-fill);
  border: none;
  border-radius: var(--radius-full);
  padding: var(--space-05) var(--space-2);
  cursor: pointer;
}
.palette .token-chip:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
.palette .palette-input {
  flex: 1;
  min-width: 140px;
  font: var(--text-body-lg);
  color: var(--g-ink);
  background: transparent;
  border: none;
  outline: none;
  height: 30px;
}
.palette .palette-input::placeholder {
  color: var(--g-ink-3);
}

.palette .token-suggest-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--g-line);
  background: var(--g-surface-2);
}
.palette .token-suggest-label {
  font: var(--text-small);
  color: var(--g-ink-3);
}

.palette .palette-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-2);
}
.palette .palette-section {
  font: var(--text-micro);
  color: var(--g-ink-3);
  padding: var(--space-2) var(--space-3) var(--space-1);
}
/* The count aside is secondary; italic marks it. */
.palette .section-note {
  font-style: italic;
}

.palette .palette-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: 6px var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  user-select: none;
  outline: none;
}
.palette .palette-row[data-highlighted] {
  background: var(--g-accent-tint);
}
.palette .class-row {
  cursor: grab;
}

.palette .row-dept {
  width: 8px;
  height: 24px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
  background: color-mix(
    in srgb,
    var(--dept-color, var(--g-line-strong)) var(--dept-rest-mix),
    var(--g-line-strong)
  );
  transition: background-color var(--motion-quick) var(--ease-out);
}
.palette .palette-row[data-highlighted] .row-dept {
  background: var(--dept-color);
}
.palette .row-id {
  font: var(--text-id);
  color: var(--g-ink);
  min-width: 72px;
  flex-shrink: 0;
}
.palette .row-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-xs);
  background: var(--g-surface-sunken);
  color: var(--g-ink-2);
  flex-shrink: 0;
}
.palette .row-icon.ok {
  background: var(--g-ok-tint);
  color: var(--g-ok);
}
.palette .row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
/* single nowrap lines: tight leading, the 2px margin does the separating */
.palette .row-title {
  font: var(--text-body);
  line-height: 1.3;
  color: var(--g-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.palette .row-sub {
  font: var(--text-small);
  line-height: 1.3;
  color: var(--g-ink-3);
  margin-top: var(--space-05);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.palette .row-sub .rating-icon {
  display: inline-block;
  vertical-align: -1px;
}
.palette .row-place {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font: var(--text-small);
  color: var(--g-ink-3);
  white-space: nowrap;
}

.palette .palette-empty {
  padding: var(--space-6) var(--space-4);
  font: var(--text-body);
  color: var(--g-ink-3);
  text-align: center;
}

.palette .palette-hint {
  border-top: 1px solid var(--g-line);
  padding: var(--space-2) var(--space-4);
  font: var(--text-small);
  color: var(--g-ink-3);
}
.palette .palette-hint code {
  font: var(--text-id-small);
  background: var(--g-surface-sunken);
  border-radius: var(--radius-xs);
  padding: 1px 5px;
}
</style>
