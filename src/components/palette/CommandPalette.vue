<template>
  <teleport to="body">
    <transition name="palette">
      <div v-if="modelValue" class="palette-scrim" @click.self="close">
        <div
          class="palette"
          role="dialog"
          aria-label="Search classes and commands"
        >
          <div class="palette-input-row">
            <g-icon name="search" :size="16" style="color: var(--g-ink-3)" />
            <div class="palette-tokens">
              <button
                v-for="token in activeTokens"
                :key="token.key"
                class="token-chip"
                :aria-label="`Remove filter ${token.label}`"
                @click="removeToken(token.key)"
              >
                {{ token.label }}
                <g-icon name="close" :size="9" />
              </button>
              <input
                ref="inputEl"
                v-model="query"
                class="palette-input"
                data-cy="classSearchInput"
                placeholder="Search classes, filters, commands..."
                autocomplete="off"
                spellcheck="false"
                @keydown="onInputKeydown"
              />
            </div>
            <g-kbd class="palette-kbd" :keys="['esc']" />
          </div>

          <div v-if="tokenSuggestions.length" class="token-suggest-row">
            <span class="token-suggest-label">filters:</span>
            <button
              v-for="suggestion in tokenSuggestions"
              :key="suggestion.key"
              class="token-suggest"
              @click="addToken(suggestion.key)"
            >
              {{ suggestion.label }}
            </button>
          </div>

          <div ref="listEl" class="palette-list">
            <!-- requirement-aware suggestions (empty query only) -->
            <template v-if="showAuditSuggestions">
              <div class="palette-section">From your audit</div>
              <button
                v-for="(suggestion, i) in auditSuggestions"
                :key="suggestion.label"
                class="palette-row suggestion-row"
                :class="{ selected: selectedIndex === i }"
                @mouseenter="selectedIndex = i"
                @click="applyAuditSuggestion(suggestion)"
              >
                <span class="row-icon ok">
                  <g-icon name="check" :size="14" />
                </span>
                <span class="row-main">
                  <span class="row-title">{{ suggestion.label }}</span>
                  <span class="row-sub">{{ suggestion.detail }}</span>
                </span>
              </button>
            </template>

            <!-- classes -->
            <template v-if="classResults.length">
              <div class="palette-section">
                Classes
                <span v-if="resultOverflow > 0" class="section-note">
                  (showing {{ classResults.length }} of
                  {{ classResults.length + resultOverflow }}, keep typing)
                </span>
              </div>
              <div
                v-for="(subject, i) in classResults"
                :key="subject.subject_id"
                class="palette-row class-row"
                :class="{ selected: selectedIndex === i + classOffset }"
                :data-cy="
                  'classInSearch' + subject.subject_id.replace('.', '_')
                "
                role="button"
                tabindex="-1"
                @mouseenter="selectedIndex = i + classOffset"
                @pointerdown="rowPointerDown($event, subject)"
                @click="placeClass(subject)"
              >
                <span
                  class="row-dept"
                  :style="{ '--dept-color': courseColor(subject) }"
                />
                <span class="row-id">{{ subject.subject_id }}</span>
                <span class="row-main">
                  <span class="row-title">{{ subject.title }}</span>
                  <span class="row-sub">
                    <template v-if="subject.total_units !== undefined"
                      >{{ subject.total_units }}u</template
                    >
                    <span v-if="termBadges(subject)" class="row-terms">{{
                      termBadges(subject)
                    }}</span>
                    <template v-if="subject.rating"
                      >· ★{{ subject.rating.toFixed(1) }}</template
                    >
                    <template v-if="subjectHoursLabel(subject)"
                      >· {{ subjectHoursLabel(subject) }}h/wk</template
                    >
                  </span>
                </span>
                <span class="row-place" aria-hidden="true">
                  {{
                    selectedIndex === i + classOffset ? "⏎ open · ⇥ place" : ""
                  }}
                </span>
              </div>
            </template>

            <!-- actions -->
            <template v-if="actionResults.length">
              <div class="palette-section">Actions</div>
              <button
                v-for="(action, i) in actionResults"
                :key="action.label"
                class="palette-row action-row"
                :class="{ selected: selectedIndex === i + actionOffset }"
                @mouseenter="selectedIndex = i + actionOffset"
                @click="runAction(action)"
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
              </button>
            </template>

            <div
              v-if="
                !classResults.length &&
                !actionResults.length &&
                !showAuditSuggestions
              "
              class="palette-empty"
            >
              Nothing matches.<template v-if="tokenSuggestions.length">
                Tab applies the suggested filter.</template
              >
            </div>
          </div>

          <!-- The filter grammar's one line of documentation. A footer
               rather than part of the empty state: with an empty query the
               base actions always render, so an empty-state hint could
               never appear. -->
          <div
            v-if="!query.length && !hasActiveFilters"
            class="palette-hint"
            data-cy="paletteGrammarHint"
          >
            Type to search {{ catalogSize }} subjects, or compose filters:
            <code>hass-a</code> then Tab, <code>spring</code> then Tab.
          </div>
        </div>
      </div>
    </transition>
  </teleport>
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
import GIcon from "../../design/components/GIcon.vue";
import GKbd from "../../design/components/GKbd.vue";
import { useIsMobile } from "../../composables/useIsMobile";
import { courseColor } from "../../lib/colors";
import { subjectHoursLabel } from "../../lib/hours";
import {
  chosenFiltersFor,
  TOKEN_DEFS,
  type TokenDef,
} from "../../lib/paletteTokens";
import { SearchIndex } from "../../lib/search";
import { sortCoursesList } from "../../lib/audit";
import type { RequirementNode, Subject } from "../../lib/types";
import { offeredSeasonLetters } from "../../lib/offering";
import { useAuditStore } from "../../stores/audit";
import { useCourseDataStore } from "../../stores/courseData";
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

const inputEl = ref<HTMLInputElement>();
const listEl = ref<HTMLElement>();
const query = ref("");
const selectedIndex = ref(0);

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
  selectedIndex.value = 0;
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

function termBadges(subject: Subject): string {
  const letters = offeredSeasonLetters(subject);
  return letters.length ? "· " + letters.join("/") : "";
}

/* ------------------------------------------------------------- actions */

interface PaletteAction {
  label: string;
  detail?: string;
  icon: string;
  keywords: string;
  run: () => void;
}

const baseActions = computed<PaletteAction[]>(() => {
  const actions: PaletteAction[] = [
    {
      label: store.isDarkMode
        ? "Switch to light theme"
        : "Switch to dark theme",
      icon: store.isDarkMode ? "sun" : "moon",
      keywords: "theme dark light mode switch",
      run: () => emit("action", "toggle-theme"),
    },
    {
      label: "New road",
      icon: "plus",
      keywords: "new road create plan",
      run: () => emit("action", "create-road"),
    },
    {
      label: "New custom activity",
      detail: "UROP, PE, anything with hours",
      icon: "pencil",
      keywords: "custom activity urop create new class",
      run: () => emit("action", "new-custom-activity"),
    },
    {
      label: "Import a road",
      icon: "upload",
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
  // Connections' graph isn't offered on mobile: it's easy to expand into
  // something heavy enough to slow down or crash the browser there.
  if (!isMobile.value) {
    actions.push({
      label: "Explore connections",
      detail: "Open Connections to discover subjects related to yours",
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
      // runAction() below keeps the palette open after this action, so a
      // student can add several programs in one session; closing here
      // too would make that guard dead code.
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
    close();
  }
}

/* ----------------------------------------- requirement-aware suggestions */

interface AuditSuggestion {
  label: string;
  detail: string;
  tokens: string[];
}

const auditSuggestions = computed<AuditSuggestion[]>(() => {
  if (query.value.length > 0 || hasActiveFilters.value) {
    return [];
  }
  const suggestions: AuditSuggestion[] = [];
  const seen = new Set<string>();
  const nextSeason = store.currentSemester % 3 === 1 ? "spring" : "fall";
  const tokenFor: Record<string, string> = {
    "HASS-A": "hass-a",
    "HASS-S": "hass-s",
    "HASS-H": "hass-h",
    "HASS-E": "hass-e",
    "CI-H": "ci-h",
    "CI-HW": "ci-hw",
  };
  const visit = (node: RequirementNode) => {
    if (suggestions.length >= 3) {
      return;
    }
    if (node.reqs !== undefined) {
      for (const child of node.reqs) {
        visit(child);
      }
      return;
    }
    if (node.fulfilled || node.req === undefined) {
      return;
    }
    const token = tokenFor[node.req];
    if (token !== undefined && !seen.has(token)) {
      seen.add(token);
      suggestions.push({
        label: `${node.req} still needed`,
        detail: `Show ${node.req} subjects offered in the ${nextSeason}`,
        tokens: [token, nextSeason],
      });
    }
  };
  for (const tree of Object.values(auditStore.reqTrees)) {
    visit(tree as RequirementNode);
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
  selectedIndex.value = 0;
  inputEl.value?.focus();
}

/* ------------------------------------------------------- selection model */

const suggestionCount = computed(() =>
  showAuditSuggestions.value ? auditSuggestions.value.length : 0,
);
const classOffset = computed(() => suggestionCount.value);
const actionOffset = computed(
  () => suggestionCount.value + classResults.value.length,
);
const totalCount = computed(
  () =>
    suggestionCount.value +
    classResults.value.length +
    actionResults.value.length,
);

watch([query, activeTokenKeys], () => {
  selectedIndex.value = 0;
});

function onInputKeydown(event: KeyboardEvent) {
  if (event.key === "Backspace" && query.value === "") {
    activeTokenKeys.value.pop();
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    selectedIndex.value = Math.min(
      selectedIndex.value + 1,
      totalCount.value - 1,
    );
    scrollSelectedIntoView();
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
    scrollSelectedIntoView();
    return;
  }
  if (event.key === "Tab" && tokenSuggestions.value.length > 0) {
    event.preventDefault();
    addToken(tokenSuggestions.value[0].key);
    return;
  }
  if (event.key === "Tab") {
    event.preventDefault();
    placeSelected();
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    activateSelected();
  }
}

/**
 * Escape closes the palette from anywhere inside it, not only from the
 * input: clicking a result row moves focus off the input, and the palette
 * still owes the key an answer. Document level, marked consumed, so the
 * window listeners in ClassDetail (clears the detail stack) and RoadCanvas
 * (cancels placement) skip the same keypress. One Escape, one layer.
 */
function onDocumentKeydown(event: KeyboardEvent) {
  if (!props.modelValue || event.key !== "Escape" || event.defaultPrevented) {
    return;
  }
  event.preventDefault();
  close();
}

onMounted(() => document.addEventListener("keydown", onDocumentKeydown));
onBeforeUnmount(() =>
  document.removeEventListener("keydown", onDocumentKeydown),
);

function scrollSelectedIntoView() {
  void nextTick(() => {
    listEl.value
      ?.querySelector(".palette-row.selected")
      ?.scrollIntoView({ block: "nearest" });
  });
}

function activateSelected() {
  const index = selectedIndex.value;
  if (showAuditSuggestions.value && index < suggestionCount.value) {
    applyAuditSuggestion(auditSuggestions.value[index]);
    return;
  }
  const classIndex = index - classOffset.value;
  if (classIndex >= 0 && classIndex < classResults.value.length) {
    openClass(classResults.value[classIndex]);
    return;
  }
  const actionIndex = index - actionOffset.value;
  if (actionIndex >= 0 && actionIndex < actionResults.value.length) {
    runAction(actionResults.value[actionIndex]);
  }
}

function placeSelected() {
  const classIndex = selectedIndex.value - classOffset.value;
  if (classIndex >= 0 && classIndex < classResults.value.length) {
    placeClass(classResults.value[classIndex]);
  }
}

/* ------------------------------------------------------------ behaviors */

/* Click and Tab arm canvas placement; Enter opens the detail. The
   pointerdown that precedes every click runs dragStartClass first, which
   presets itemAdding with the same subject and addingFromCard false, so
   the addFromCard here overwrites rather than double-arms. */

function openClass(subject: Subject) {
  store.pushClassStack(subject.subject_id);
  close();
}

function placeClass(subject: Subject) {
  store.addFromCard(subject);
  close();
}

function rowPointerDown(event: PointerEvent, subject: Subject) {
  store.dragStartClass({ classInfo: subject });
  pointerDown(event, { subject, isNew: true });
}

function close() {
  emit("update:modelValue", false);
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      query.value = "";
      activeTokenKeys.value = [];
      selectedIndex.value = 0;
      void nextTick(() => inputEl.value?.focus());
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

<style scoped>
.palette-scrim {
  position: fixed;
  inset: 0;
  background: var(--g-scrim);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 11vh;
  z-index: 120;
}

.palette {
  width: 640px;
  max-width: calc(100vw - 32px);
  max-height: 64vh;
  display: flex;
  flex-direction: column;
  background: var(--g-surface);
  border: 1px solid var(--g-overlay-line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-3);
  overflow: hidden;
}

.palette-input-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--g-line);
}
.palette-tokens {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  min-width: 0;
}
.token-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font: var(--text-small);
  font-weight: 600;
  color: var(--g-on-accent);
  background: var(--g-accent-fill);
  border: none;
  border-radius: var(--radius-full);
  padding: 2px var(--space-2);
  cursor: pointer;
}
.palette-input {
  flex: 1;
  min-width: 140px;
  font: var(--text-body-lg);
  color: var(--g-ink);
  background: transparent;
  border: none;
  outline: none;
  height: 30px;
}
.palette-input::placeholder {
  color: var(--g-ink-3);
}

.token-suggest-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--g-line);
  background: var(--g-surface-2);
}
.token-suggest-label {
  font: var(--text-small);
  color: var(--g-ink-3);
}
.token-suggest {
  font: var(--text-small);
  color: var(--g-ink-2);
  background: var(--g-surface-sunken);
  border: none;
  border-radius: var(--radius-full);
  padding: 2px var(--space-2);
  cursor: pointer;
}
.token-suggest:hover {
  background: var(--g-accent-tint);
  color: var(--g-ink);
}

.palette-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2);
}
.palette-section {
  font: var(--text-micro);
  letter-spacing: var(--tracking-caps);
  text-transform: uppercase;
  color: var(--g-ink-3);
  padding: var(--space-2) var(--space-3) var(--space-1);
}
.section-note {
  text-transform: none;
  letter-spacing: 0;
}

.palette-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: 6px var(--space-3);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  text-align: left;
  user-select: none;
}
.palette-row.selected {
  background: var(--g-accent-tint);
}
.class-row {
  cursor: grab;
}

.row-dept {
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
.palette-row.selected .row-dept {
  background: var(--dept-color);
}
.row-id {
  font: var(--text-id);
  color: var(--g-ink);
  min-width: 72px;
  flex-shrink: 0;
}
.row-icon {
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
.row-icon.ok {
  background: var(--g-ok-tint);
  color: var(--g-ok);
}
.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
/* single nowrap lines: tight leading, the 2px margin does the separating */
.row-title {
  font: var(--text-body);
  line-height: 1.3;
  color: var(--g-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-sub {
  font: var(--text-small);
  line-height: 1.3;
  color: var(--g-ink-3);
  margin-top: var(--space-05);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-terms {
  font-family: var(--font-mono);
}
.row-place {
  font: var(--text-small);
  color: var(--g-ink-3);
  white-space: nowrap;
}

.palette-empty {
  padding: var(--space-6) var(--space-4);
  font: var(--text-body);
  color: var(--g-ink-3);
  text-align: center;
}

.palette-hint {
  border-top: 1px solid var(--g-line);
  padding: var(--space-2) var(--space-4);
  font: var(--text-small);
  color: var(--g-ink-3);
}
.palette-hint code {
  font: var(--text-id-small);
  background: var(--g-surface-sunken);
  border-radius: var(--radius-xs);
  padding: 1px 5px;
}

.palette-enter-active {
  transition: opacity var(--motion-quick) var(--ease-out);
}
.palette-enter-active .palette {
  transition:
    transform var(--motion-standard) var(--ease-settle),
    opacity var(--motion-quick) var(--ease-out);
}
.palette-leave-active {
  transition: opacity var(--motion-instant) var(--ease-in);
}
.palette-enter-from {
  opacity: 0;
}
.palette-enter-from .palette {
  transform: translateY(-8px) scale(0.99);
}
.palette-leave-to {
  opacity: 0;
}
</style>
