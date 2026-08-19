<template>
  <div class="styleguide">
    <header class="sg-header">
      <g-wordmark size="lg" />
      <p class="sg-tagline">
        Every token and component in CourseRoad, rendered live. Switch the theme
        to check both.
      </p>
      <div class="sg-controls">
        <g-button variant="subtle" @click="toggleTheme">
          {{ isDark ? "Switch to light" : "Switch to dark" }}
        </g-button>
        <theme-toggle :dark="isDark" @toggle="toggleTheme" />
        <router-link to="/road" class="sg-back"
          ><g-icon name="back" :size="12" /> back to the app</router-link
        >
      </div>
    </header>

    <!-- ============ principles ============ -->
    <section class="sg-section">
      <h2 class="sg-h2">Principles</h2>
      <dl class="sg-principles">
        <template v-for="p in principles" :key="p.title">
          <dt class="sg-principle-title">{{ p.title }}</dt>
          <dd class="sg-principle-body">{{ p.body }}</dd>
        </template>
      </dl>
    </section>

    <!-- ============ color ============ -->
    <section class="sg-section">
      <h2 class="sg-h2">Color</h2>
      <p class="sg-body sg-note">
        Cool institute neutrals, MIT cardinal as the one accent, and quiet
        semantic tints. Dark is basalt: MIT silver leads, and cardinal is kept
        for identity. Dark values are designed, not inverted.
      </p>
      <div class="sg-swatch-grid">
        <div
          v-for="swatch in semanticSwatches"
          :key="swatch.name"
          class="sg-swatch"
        >
          <div
            class="sg-swatch-color"
            :style="{ background: `var(${swatch.varName})` }"
          />
          <span class="sg-swatch-name">{{ swatch.name }}</span>
          <code class="sg-swatch-var">{{ swatch.varName }}</code>
        </div>
      </div>

      <h3 class="sg-h3" style="margin-top: var(--space-6)">
        Department colors
      </h3>
      <p class="sg-body sg-note">
        Every department sits in a fixed OKLCH lightness/chroma band, so chips
        are equally vivid and on-color text passes contrast by construction.
        Hues are carried over from the legacy CourseRoad, providing familiarity
        to users.
      </p>
      <div class="sg-dept-grid">
        <div
          v-for="dept in deptSwatches"
          :key="dept.key"
          class="sg-dept-chip"
          :style="{
            background: `var(--dept-${dept.key})`,
            color: 'var(--dept-on)',
          }"
        >
          <span class="sg-dept-id">{{ dept.label }}</span>
          <span class="sg-dept-name">{{ dept.name }}</span>
        </div>
      </div>
    </section>

    <!-- ============ type ============ -->
    <section class="sg-section">
      <h2 class="sg-h2">Type</h2>
      <p class="sg-body sg-note">
        IBM Plex Sans for both display and interface and IBM Plex Mono for
        subject ids and numeric data. Ids are always mono, because they are the
        atomic unit of the product.
      </p>
      <g-card class="sg-type-ramp">
        <div class="sg-type-row">
          <code class="sg-type-token">--text-display</code>
          <span style="font: var(--text-display)">Plan the whole climb</span>
        </div>
        <div class="sg-type-row">
          <code class="sg-type-token">--text-title</code>
          <span style="font: var(--text-title)"
            >Sophomore Spring · 48 units</span
          >
        </div>
        <div class="sg-type-row">
          <code class="sg-type-token">--text-heading</code>
          <span style="font: var(--text-heading)">Requirements satisfied</span>
        </div>
        <div class="sg-type-row">
          <code class="sg-type-token">--text-body</code>
          <span style="font: var(--text-body)">
            Introduction to Algorithms. Techniques for the design and analysis
            of efficient algorithms.
          </span>
        </div>
        <div class="sg-type-row">
          <code class="sg-type-token">--text-small</code>
          <span style="font: var(--text-small); color: var(--g-ink-2)">
            Prereq: 6.1200 or 18.062 · 12 units · Fall, Spring
          </span>
        </div>
        <div class="sg-type-row">
          <code class="sg-type-token">--text-micro</code>
          <span
            style="
              font: var(--text-micro);
              letter-spacing: var(--tracking-caps);
              text-transform: uppercase;
              color: var(--g-ink-3);
            "
            >Classes</span
          >
        </div>
        <div class="sg-type-row">
          <code class="sg-type-token">--text-id</code>
          <span style="font: var(--text-id)">6.006 · 18.01 · 21M.301</span>
        </div>
      </g-card>
    </section>

    <!-- ============ space & shape ============ -->
    <section class="sg-section">
      <h2 class="sg-h2">Space &amp; shape</h2>
      <div class="sg-row">
        <g-card class="sg-half">
          <h3 class="sg-h3">Spacing on a 4px grid</h3>
          <div class="sg-space-ramp">
            <div
              v-for="s in [1, 2, 3, 4, 6, 8, 12]"
              :key="s"
              class="sg-space-row"
            >
              <code class="sg-type-token">--space-{{ s }}</code>
              <span
                class="sg-space-bar"
                :style="{ width: `var(--space-${s})` }"
              />
            </div>
          </div>
        </g-card>
        <g-card class="sg-half">
          <h3 class="sg-h3">Radius &amp; elevation</h3>
          <div class="sg-shape-row">
            <div
              v-for="r in ['xs', 'sm', 'md', 'lg']"
              :key="r"
              class="sg-radius-demo"
              :style="{ borderRadius: `var(--radius-${r})` }"
            >
              {{ r }}
            </div>
          </div>
          <div class="sg-shape-row" style="margin-top: var(--space-4)">
            <div
              v-for="e in [1, 2, 3]"
              :key="e"
              class="sg-shadow-demo"
              :style="{ boxShadow: `var(--shadow-${e})` }"
            >
              shadow-{{ e }}
            </div>
          </div>
        </g-card>
      </div>
    </section>

    <!-- ============ motion ============ -->
    <section class="sg-section">
      <h2 class="sg-h2">Motion</h2>
      <p class="sg-body sg-note">
        Things come from where they were and go where they're going. Enter
        decelerates, exit accelerates, settling may overshoot slightly. Distance
        buys duration, and reduced motion collapses all of it.
      </p>
      <g-card>
        <div class="sg-motion-row">
          <g-button variant="subtle" @click="runMotionDemo">
            Play choreography
          </g-button>
          <div class="sg-motion-track">
            <div
              class="sg-motion-dot quick"
              :class="{ go: motionPlaying }"
            ></div>
            <div
              class="sg-motion-dot standard"
              :class="{ go: motionPlaying }"
            ></div>
            <div
              class="sg-motion-dot deliberate"
              :class="{ go: motionPlaying }"
            ></div>
          </div>
          <div class="sg-motion-labels">
            <code>quick 140ms</code>
            <code>standard 220ms</code>
            <code>deliberate 340ms</code>
          </div>
        </div>
      </g-card>
    </section>

    <!-- ============ components ============ -->
    <section class="sg-section">
      <h2 class="sg-h2">Components</h2>

      <g-card class="sg-component-block">
        <h3 class="sg-h3">Buttons</h3>
        <div class="sg-row-wrap">
          <g-button variant="primary">Add to plan</g-button>
          <g-button variant="subtle">Duplicate road</g-button>
          <g-button variant="ghost">Cancel</g-button>
          <g-button variant="danger">Delete road</g-button>
          <g-button variant="primary" disabled>Disabled</g-button>
          <g-button variant="subtle" disabled>Disabled</g-button>
          <g-button variant="primary" loading>Importing...</g-button>
          <g-button variant="subtle" size="sm">Small</g-button>
        </div>
      </g-card>

      <g-card class="sg-component-block">
        <h3 class="sg-h3">Inputs</h3>
        <div class="sg-row-wrap" style="align-items: flex-start">
          <g-input
            v-model="demoInput"
            label="Road name"
            placeholder="Junior year, but ambitious"
            hint="Visible on the tab"
            style="width: 260px"
          />
          <g-input
            v-model="demoInputInvalid"
            label="Subject number"
            invalid
            error="There's already a road with this name."
            style="width: 260px"
          />
        </div>
      </g-card>

      <g-card class="sg-component-block">
        <h3 class="sg-h3">Number field &amp; select</h3>
        <div class="sg-row-wrap" style="align-items: flex-start">
          <g-number-field
            v-model="demoNumber"
            label="Units"
            :min="0"
            style="width: 140px"
          />
          <g-select
            v-model="demoSelect"
            label="Term"
            :options="demoSelectOptions"
            style="width: 200px"
          />
        </div>
      </g-card>

      <g-card class="sg-component-block">
        <h3 class="sg-h3">Progress</h3>
        <div class="sg-row-wrap" style="align-items: flex-start">
          <g-progress
            class="sg-progress-demo"
            fill-class="sg-progress-demo-fill"
            :value="68"
          />
        </div>
      </g-card>

      <g-card class="sg-component-block">
        <h3 class="sg-h3">Chips</h3>
        <div class="sg-row-wrap">
          <g-chip>Fall</g-chip>
          <g-chip interactive>HASS-A</g-chip>
          <g-chip selected>CI-H</g-chip>
          <g-chip closable @close="noop">6-3 Major</g-chip>
          <g-chip dept="course-6" closable @close="noop">6.006</g-chip>
          <g-chip dept="course-21M">21M.301</g-chip>
          <g-chip dept="course-8">8.01</g-chip>
        </div>
      </g-card>

      <g-card class="sg-component-block">
        <h3 class="sg-h3">Drawer</h3>
        <div class="sg-row-wrap">
          <g-button variant="subtle" @click="demoDrawer = true">
            Open drawer
          </g-button>
          <g-drawer v-model="demoDrawer" label="Demo drawer">
            <div class="sg-drawer-demo">
              <strong style="font: var(--text-body-strong)"
                >A bottom sheet</strong
              >
              <span style="font: var(--text-small); color: var(--g-ink-2)">
                Swipe down, tap outside, or press Escape to close.
              </span>
            </div>
          </g-drawer>
        </div>
      </g-card>

      <g-card class="sg-component-block">
        <h3 class="sg-h3">Popover &amp; tooltip</h3>
        <div class="sg-row-wrap">
          <g-popover v-model="demoPopover">
            <template #anchor="{ toggle }">
              <g-button variant="subtle" @click="toggle">Open popover</g-button>
            </template>
            <div
              style="display: flex; flex-direction: column; gap: var(--space-2)"
            >
              <strong style="font: var(--text-body-strong)"
                >Move 6.006 here?</strong
              >
              <span style="font: var(--text-small); color: var(--g-ink-2)">
                Offered in spring · prereqs satisfied
              </span>
              <g-button variant="primary" size="sm" @click="demoPopover = false"
                >Place it</g-button
              >
            </div>
          </g-popover>
          <g-tooltip text="Expected hours, averaged across terms">
            <g-button variant="ghost">Hover for tooltip</g-button>
          </g-tooltip>
        </div>
      </g-card>

      <g-card class="sg-component-block">
        <h3 class="sg-h3">Toasts with undo as the confirmation</h3>
        <div class="sg-row-wrap">
          <g-button variant="subtle" @click="demoUndoToast">
            Delete with undo
          </g-button>
          <g-button variant="subtle" @click="toast.ok('Road saved')">
            Success
          </g-button>
          <g-button
            variant="subtle"
            @click="
              toast.warn(
                '8.02 isn\'t usually offered in IAP',
                'It will stay on your plan with a warning.',
              )
            "
          >
            Warning
          </g-button>
        </div>
      </g-card>
    </section>

    <footer class="sg-footer">
      <span class="sg-small">
        CourseRoad design language · tokens in
        <code>src/design/tokens.css</code>
      </span>
    </footer>

    <g-toast-host />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import GButton from "../design/components/GButton.vue";
import GCard from "../design/components/GCard.vue";
import GChip from "../design/components/GChip.vue";
import GDrawer from "../design/components/GDrawer.vue";
import GIcon from "../design/components/GIcon.vue";
import GInput from "../design/components/GInput.vue";
import GNumberField from "../design/components/GNumberField.vue";
import GPopover from "../design/components/GPopover.vue";
import GProgress from "../design/components/GProgress.vue";
import GSelect from "../design/components/GSelect.vue";
import GToastHost from "../design/components/GToastHost.vue";
import GTooltip from "../design/components/GTooltip.vue";
import GWordmark from "../design/components/GWordmark.vue";
import ThemeToggle from "../components/shell/ThemeToggle.vue";
import { toast } from "../design/toast.ts";
import { useTheme } from "../composables/useTheme.ts";
import { useCourseDataStore } from "../stores/courseData.ts";

const store = useCourseDataStore();

const isDark = computed(() => Boolean(store.isDarkMode));

const { toggleTheme } = useTheme();

const demoInput = ref("");
const demoInputInvalid = ref("Junior year");
const demoNumber = ref(12);
const demoSelect = ref("fall");
const demoSelectOptions = [
  { value: "fall", label: "Fall" },
  { value: "iap", label: "IAP" },
  { value: "spring", label: "Spring" },
];
const demoPopover = ref(false);
const demoDrawer = ref(false);
const motionPlaying = ref(false);

function runMotionDemo() {
  motionPlaying.value = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      motionPlaying.value = true;
    });
  });
}

function demoUndoToast() {
  toast.undoable("“Sophomore spring” deleted", () =>
    toast.ok("Road restored", "Everything is back where it was."),
  );
}

function noop() {}

const principles = [
  {
    title: "The plan is the hero",
    body: "One canvas, the whole journey visible. Search, detail, and the audit orbit the plan. Nothing buries it.",
  },
  {
    title: "Show consequences, live",
    body: "Selecting a class updates, in the same frame, what it unlocks, what it needs, what it satisfies, and what it breaks.",
  },
  {
    title: "Direct manipulation",
    body: "Rename in place. Confirm destruction with undo, never a confirmation prompt. Every modal must justify its existence.",
  },
  {
    title: "Motion explains",
    body: "Things come from where they were and go where they're going. Enter decelerates, exit accelerates, settling may overshoot slightly. Distance buys duration.",
  },
  {
    title: "Decoration encodes",
    body: "Color means department. Weight means load. Green means progress. No color without a meaning, and each fact encoded once.",
  },
  {
    title: "Fast feels inevitable",
    body: "Optimistic updates. No layout shift when data arrives. Search results update per keystroke.",
  },
];

const semanticSwatches = [
  { name: "Background", varName: "--g-bg" },
  { name: "Surface", varName: "--g-surface" },
  { name: "Sunken", varName: "--g-surface-sunken" },
  { name: "Ink", varName: "--g-ink" },
  { name: "Ink 2", varName: "--g-ink-2" },
  { name: "Ink 3", varName: "--g-ink-3" },
  { name: "Line", varName: "--g-line" },
  { name: "Cardinal", varName: "--g-accent" },
  { name: "Brand", varName: "--g-brand" },
  { name: "OK", varName: "--g-ok" },
  { name: "Warn", varName: "--g-warn" },
  { name: "Danger", varName: "--g-danger" },
  { name: "Info", varName: "--g-info" },
];

const deptSwatches = [
  { key: "course-1", label: "1", name: "Civil & Env" },
  { key: "course-2", label: "2", name: "MechE" },
  { key: "course-3", label: "3", name: "Materials" },
  { key: "course-4", label: "4", name: "Architecture" },
  { key: "course-5", label: "5", name: "Chemistry" },
  { key: "course-6", label: "6", name: "EECS" },
  { key: "course-7", label: "7", name: "Biology" },
  { key: "course-8", label: "8", name: "Physics" },
  { key: "course-9", label: "9", name: "Brain & Cog" },
  { key: "course-10", label: "10", name: "ChemE" },
  { key: "course-11", label: "11", name: "Urban Studies" },
  { key: "course-12", label: "12", name: "EAPS" },
  { key: "course-14", label: "14", name: "Economics" },
  { key: "course-15", label: "15", name: "Management" },
  { key: "course-16", label: "16", name: "AeroAstro" },
  { key: "course-17", label: "17", name: "Political Sci" },
  { key: "course-18", label: "18", name: "Math" },
  { key: "course-20", label: "20", name: "BioE" },
  { key: "course-21H", label: "21H", name: "History" },
  { key: "course-21L", label: "21L", name: "Literature" },
  { key: "course-21M", label: "21M", name: "Music" },
  { key: "course-21W", label: "21W", name: "Writing" },
  { key: "course-22", label: "22", name: "Nuclear" },
  { key: "course-24", label: "24", name: "Ling & Phil" },
  { key: "course-CMS", label: "CMS", name: "Comp Media" },
  { key: "course-HST", label: "HST", name: "Health Sci" },
  { key: "course-MAS", label: "MAS", name: "Media Arts" },
  { key: "course-STS", label: "STS", name: "STS" },
  { key: "generic-GIR", label: "GIR", name: "Generic GIR" },
  { key: "generic-HASS-A", label: "H-A", name: "HASS Arts" },
  { key: "generic-CI-H", label: "CI-H", name: "Comm Intensive" },
  { key: "course-none", label: "?", name: "Unknown" },
];
</script>

<style scoped>
.styleguide {
  min-height: 100vh;
  background: var(--g-bg);
  color: var(--g-ink);
  font: var(--text-body);
  padding: var(--space-10) var(--space-8) var(--space-16);
  max-width: 1080px;
  margin: 0 auto;
}

.sg-header {
  margin-bottom: var(--space-12);
}
.sg-tagline {
  font: var(--text-title);
  font-weight: 400;
  color: var(--g-ink-2);
  max-width: 38em;
  margin: var(--space-4) 0 var(--space-5);
}
.sg-controls {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}
.sg-back {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font: var(--text-small);
  color: var(--g-ink-3);
  text-decoration: none;
}
.sg-back:hover {
  color: var(--g-accent);
}

.sg-section {
  margin-bottom: var(--space-12);
}
.sg-h2 {
  font: var(--text-title);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--g-line);
}
.sg-h3 {
  font: var(--text-heading);
  margin-bottom: var(--space-3);
}
.sg-body {
  font: var(--text-body);
  color: var(--g-ink-2);
}
.sg-note {
  max-width: 46em;
  margin-bottom: var(--space-5);
}
.sg-small {
  font: var(--text-small);
  color: var(--g-ink-3);
}

.sg-principles {
  display: grid;
  grid-template-columns: minmax(9rem, max-content) minmax(0, 34em);
  gap: var(--space-2) var(--space-5);
  margin: 0;
  max-width: 52em;
}
.sg-principle-title {
  font: var(--text-body-strong);
  color: var(--g-ink);
}
.sg-principle-body {
  font: var(--text-body);
  color: var(--g-ink-2);
  margin: 0;
}
@media (max-width: 640px) {
  .sg-principles {
    grid-template-columns: 1fr;
    gap: var(--space-1);
  }
  .sg-principle-body {
    margin-bottom: var(--space-3);
  }
}

.sg-swatch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--space-3);
}
.sg-swatch {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.sg-swatch-color {
  height: 56px;
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--g-line);
}
.sg-swatch-name {
  font: var(--text-body-strong);
}
.sg-swatch-var {
  font: var(--text-id-small);
  color: var(--g-ink-3);
}

.sg-dept-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: var(--space-2);
}
.sg-dept-chip {
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-height: 52px;
  transition: background-color var(--motion-standard) var(--ease-out);
}
.sg-dept-id {
  font: var(--text-id);
}
.sg-dept-name {
  font: var(--text-small);
  opacity: 0.85;
}

.sg-type-ramp {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.sg-type-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: var(--space-4);
  align-items: baseline;
}
.sg-type-token {
  font: var(--text-id-small);
  color: var(--g-ink-3);
}

.sg-row {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.sg-half {
  flex: 1 1 320px;
  padding: var(--space-5);
}
.sg-space-ramp {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.sg-space-row {
  display: grid;
  grid-template-columns: 110px 1fr;
  align-items: center;
  gap: var(--space-3);
}
.sg-space-bar {
  height: 14px;
  background: var(--g-accent);
  border-radius: var(--radius-xs);
  opacity: 0.85;
}
.sg-shape-row {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.sg-radius-demo {
  width: 72px;
  height: 56px;
  background: var(--g-surface-sunken);
  box-shadow: inset 0 0 0 1.5px var(--g-line-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  font: var(--text-small);
  color: var(--g-ink-2);
}
.sg-shadow-demo {
  width: 100px;
  height: 56px;
  background: var(--g-surface);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font: var(--text-small);
  color: var(--g-ink-2);
}

.sg-motion-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
}
.sg-motion-track {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.sg-motion-dot {
  width: 18px;
  height: 18px;
  border-radius: var(--radius-full);
  background: var(--g-accent);
  transform: translateX(0);
}
.sg-motion-dot.quick.go {
  transition: transform var(--motion-quick) var(--ease-out);
  transform: translateX(220px);
}
.sg-motion-dot.standard.go {
  transition: transform var(--motion-standard) var(--ease-out);
  transform: translateX(220px);
}
.sg-motion-dot.deliberate.go {
  transition: transform var(--motion-deliberate) var(--ease-settle);
  transform: translateX(220px);
}
.sg-motion-labels {
  display: flex;
  gap: var(--space-5);
  font: var(--text-id-small);
  color: var(--g-ink-3);
}

.sg-component-block {
  padding: var(--space-5);
  margin-bottom: var(--space-4);
}
.sg-drawer-demo {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.sg-progress-demo {
  width: 240px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--g-surface-sunken);
  overflow: hidden;
}
/* :deep(): GProgress's own indicator, a grandchild from here. */
:deep(.sg-progress-demo-fill) {
  display: block;
  height: 100%;
  background: var(--g-progress);
}
.sg-row-wrap {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  align-items: center;
}

.sg-footer {
  border-top: 1px solid var(--g-line);
  padding-top: var(--space-5);
}
</style>
