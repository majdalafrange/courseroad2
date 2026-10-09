<template>
  <div class="styleguide">
    <header class="sg-header">
      <g-wordmark size="lg" />
      <p class="sg-tagline">
        Every token and component in CourseRoad. Styled components render live;
        behavior primitives are listed with where the app styles them. Switch
        the theme to check both.
      </p>
      <div class="sg-controls">
        <g-button variant="subtle" @click="toggleTheme">
          {{ isDark ? "Switch to light" : "Switch to dark" }}
        </g-button>
        <router-link v-slot="{ href, navigate }" to="/road" custom>
          <g-link :href="href" tone="quiet" @click="navigate">
            <g-icon name="back" :size="12" /> Back to the app
          </g-link>
        </router-link>
      </div>
    </header>

    <!-- principles -->
    <section class="sg-section">
      <h2 class="sg-h2">Principles</h2>
      <dl class="sg-principles">
        <template v-for="p in principles" :key="p.title">
          <dt class="sg-principle-title">{{ p.title }}</dt>
          <dd class="sg-principle-body">{{ p.body }}</dd>
        </template>
      </dl>
    </section>

    <!-- color -->
    <section class="sg-section">
      <h2 class="sg-h2">Color</h2>
      <p class="sg-body sg-note">
        Cool gray neutrals, MIT cardinal as the single accent, and muted
        semantic tints. Dark mode leads with MIT silver and keeps cardinal for
        the brand mark. Dark values are set by hand, not inverted.
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
        Hues are carried over from the previous CourseRoad so returning students
        recognize them.
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

    <!-- type -->
    <section class="sg-section">
      <h2 class="sg-h2">Type</h2>
      <p class="sg-body sg-note">
        Overpass Variable for display and interface, Overpass Mono Variable for
        subject ids and numeric data. The fixed advance keeps ids made of
        letters and ids made of digits aligned down a list.
      </p>
      <g-card class="sg-type-ramp">
        <div class="sg-type-row">
          <code class="sg-type-token">--text-display</code>
          <span style="font: var(--text-display)">Plan all four years</span>
        </div>
        <div class="sg-type-row">
          <code class="sg-type-token">--text-title</code>
          <span style="font: var(--text-title)"
            >Sophomore Spring <span class="sep">·</span> 48 units</span
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
            Prereq: 6.1200 or 18.062 <span class="sep">·</span> 12 units
            <span class="sep">·</span> Fall, Spring
          </span>
        </div>
        <div class="sg-type-row">
          <code class="sg-type-token">--text-micro</code>
          <span style="font: var(--text-micro); color: var(--g-ink-3)"
            >Classes</span
          >
        </div>
        <div class="sg-type-row">
          <code class="sg-type-token">--text-id</code>
          <span style="font: var(--text-id)">6.006 · 18.01 · 21M.301</span>
        </div>
        <div class="sg-type-row">
          <code class="sg-type-token">--text-id-small</code>
          <span style="font: var(--text-id-small); color: var(--g-ink-3)"
            >Fall '26</span
          >
        </div>
      </g-card>
    </section>

    <!-- space & shape -->
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

    <!-- motion -->
    <section class="sg-section">
      <h2 class="sg-h2">Motion</h2>
      <p class="sg-body sg-note">
        Elements enter with an ease-out curve and leave with an ease-in. Longer
        distances get longer durations. With reduced motion enabled, transitions
        are skipped.
      </p>
      <g-card>
        <div class="sg-motion-row">
          <g-button
            class="sg-motion-play"
            variant="subtle"
            @click="runMotionDemo"
          >
            Play
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

    <!-- components -->
    <section class="sg-section">
      <h2 class="sg-h2">Components</h2>

      <g-card class="sg-component-block">
        <h3 class="sg-h3">Buttons</h3>
        <div class="sg-row-wrap">
          <g-button variant="primary">Add to plan</g-button>
          <g-button variant="subtle">Duplicate road</g-button>
          <g-button variant="ghost">Cancel</g-button>
          <g-button variant="danger">Delete road</g-button>
          <g-button variant="primary" disabled>Primary, disabled</g-button>
          <g-button variant="subtle" disabled>Subtle, disabled</g-button>
          <g-button variant="primary" loading>Importing...</g-button>
          <g-button variant="subtle" size="sm">Small</g-button>
          <g-button variant="ghost" size="xs" icon-only aria-label="Close">
            <g-icon name="close" :size="13" />
          </g-button>
          <g-button variant="link" size="sm">Retry</g-button>
          <g-button size="sm" href="https://catalog.mit.edu/" external>
            Catalog <g-icon name="external" :size="12" />
          </g-button>
        </div>
      </g-card>

      <g-card class="sg-component-block">
        <h3 class="sg-h3">Links</h3>
        <p class="sg-body sg-note">
          Inline, in a sentence: confirm with the
          <g-link href="https://student.mit.edu/" external
            >official audit</g-link
          >.
        </p>
        <p class="sg-body sg-note">
          Quiet, standing alone:
          <g-link href="https://catalog.mit.edu/" tone="quiet" external
            >Degree charts</g-link
          >
        </p>
      </g-card>

      <g-card class="sg-component-block">
        <h3 class="sg-h3">Checkbox</h3>
        <div class="sg-row-wrap">
          <g-checkbox v-model="demoCheck">Show a fifth year</g-checkbox>
          <g-checkbox :model-value="false" disabled>Disabled</g-checkbox>
        </div>
      </g-card>

      <g-card class="sg-component-block">
        <h3 class="sg-h3">Inputs</h3>
        <div class="sg-row-wrap" style="align-items: flex-start">
          <g-input
            v-model="demoInput"
            label="Road name"
            placeholder="Junior spring draft"
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
        <p class="sg-body sg-note">
          Their captions are GLabel, which ties a caption to a control by id.
        </p>
      </g-card>

      <g-card class="sg-component-block">
        <h3 class="sg-h3">Text area</h3>
        <g-textarea
          v-model="demoNote"
          label="Note on 6.006"
          placeholder="Check prereqs with the instructor"
          hint="Up to 280 characters."
          :maxlength="280"
          style="max-width: 420px"
        />
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
          <g-popover v-model="demoPopover" label="Demo popover">
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
                Offered in spring <span class="sep">·</span> prereqs satisfied
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
        <h3 class="sg-h3">Menu</h3>
        <p class="sg-body sg-note">
          Actions on a road. A destructive item turns red only while
          highlighted.
        </p>
        <g-menu v-model="demoMenu">
          <template #trigger>
            <g-button variant="subtle">
              Road actions <g-icon name="chevronDown" :size="13" />
            </g-button>
          </template>
          <g-menu-item>Duplicate road</g-menu-item>
          <g-menu-item>Export as .road</g-menu-item>
          <g-menu-separator />
          <g-menu-item danger>Delete road</g-menu-item>
        </g-menu>
      </g-card>

      <g-card class="sg-component-block">
        <h3 class="sg-h3">Sheet</h3>
        <p class="sg-body sg-note">
          For tasks with no in-place alternative, such as importing a file.
        </p>
        <g-button variant="subtle" @click="demoSheet = true">
          Import a road
        </g-button>
        <g-sheet v-model="demoSheet" label="Import road" width="480px">
          <div class="sg-sheet-demo">
            <h2 class="sg-h3">Import road</h2>
            <g-textarea
              v-model="demoImport"
              label="Contents of a .road file"
              monospace
              :rows="5"
            />
            <div class="sg-sheet-actions">
              <g-button variant="ghost" @click="demoSheet = false">
                Cancel
              </g-button>
              <g-button variant="primary" @click="demoSheet = false">
                Import
              </g-button>
            </div>
          </div>
        </g-sheet>
      </g-card>

      <g-card class="sg-component-block">
        <h3 class="sg-h3">Keyboard keys</h3>
        <p class="sg-body sg-note">
          Press <g-kbd :keys="searchKeys.keys" :joiner="searchKeys.joiner" /> to
          add classes, <g-kbd :keys="['Enter']" /> to place one, and
          <g-kbd :keys="['Esc']" /> to cancel.
        </p>
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

      <g-card class="sg-component-block">
        <h3 class="sg-h3">Behavior primitives</h3>
        <p class="sg-body sg-note">
          These carry keyboard and screen-reader behavior only. The feature that
          uses each one styles it; the last column says where to look.
        </p>
        <table class="sg-primitives">
          <thead>
            <tr>
              <th scope="col">Component</th>
              <th scope="col">Provides</th>
              <th scope="col">Styled in</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in primitives" :key="p.name">
              <td>
                <code>{{ p.name }}</code>
              </td>
              <td data-label="Provides">{{ p.provides }}</td>
              <td data-label="Styled in">{{ p.seeIt }}</td>
            </tr>
          </tbody>
        </table>
      </g-card>
    </section>

    <footer class="sg-footer">
      <span class="sg-small">
        CourseRoad design language <span class="sep">·</span> tokens in
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
import GCheckbox from "../design/components/GCheckbox.vue";
import GChip from "../design/components/GChip.vue";
import GDrawer from "../design/components/GDrawer.vue";
import GIcon from "../design/components/GIcon.vue";
import GInput from "../design/components/GInput.vue";
import GKbd from "../design/components/GKbd.vue";
import GLink from "../design/components/GLink.vue";
import { GMenu, GMenuItem, GMenuSeparator } from "../design/components/GMenu";
import GNumberField from "../design/components/GNumberField.vue";
import GPopover from "../design/components/GPopover.vue";
import GProgress from "../design/components/GProgress.vue";
import GSelect from "../design/components/GSelect.vue";
import GSheet from "../design/components/GSheet.vue";
import GTextarea from "../design/components/GTextarea.vue";
import { GToastHost } from "../design/components/GToast";
import GTooltip from "../design/components/GTooltip.vue";
import GWordmark from "../design/components/GWordmark.vue";
import { toast } from "../design/toast.ts";
import { useTheme } from "../composables/useTheme.ts";
import { shortcutKeys } from "../lib/platform.ts";
import { useCourseDataStore } from "../stores/courseData.ts";

const store = useCourseDataStore();

const isDark = computed(() => Boolean(store.isDarkMode));

const { toggleTheme } = useTheme();

const demoInput = ref("");
const demoCheck = ref(true);
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
const demoNote = ref("");
const demoMenu = ref(false);
const demoSheet = ref(false);
const demoImport = ref("");
const searchKeys = shortcutKeys("K");

const primitives = [
  {
    name: "GRadioGroup",
    provides: "One choice from a set, with arrow keys",
    seeIt: "Settings: every choice there",
  },
  {
    name: "GMenuLabel, GMenuRadioGroup",
    provides: "A menu caption, and one choice that stays picked",
    seeIt: "The road switcher: the road list and its active mark",
  },
  {
    name: "GTabs",
    provides: "Switching panels, with arrow keys",
    seeIt: "Degree fit: majors and minors",
  },
  {
    name: "GCombobox",
    provides: "A search field over a list of results",
    seeIt: "The command palette (Add classes)",
  },
  {
    name: "GColorSwatchPicker",
    provides: "A color grid, each swatch named for screen readers",
    seeIt: "New custom activity: Color",
  },
];
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
  toast.undoable("“Sophomore spring” deleted", () => toast.ok("Road restored"));
}

function noop() {}

const principles = [
  {
    title: "The plan comes first",
    body: "The road canvas is the main view. Search, class detail, and the audit sit beside it and never cover it.",
  },
  {
    title: "Show consequences immediately",
    body: "Selecting a class shows, without delay, what it unlocks, what it requires, and which requirements it satisfies.",
  },
  {
    title: "Edit in place",
    body: "Rename inline. Destructive actions run right away and offer Undo instead of a confirmation prompt. Dialogs are used only when there is no in-place alternative.",
  },
  {
    title: "Motion shows where things went",
    body: "Elements move from where they were to where they end up. Enter uses ease-out, exit uses ease-in, and longer distances get longer durations.",
  },
  {
    title: "Color carries meaning",
    body: "Color means department. Green means progress. Nothing is colored for decoration alone.",
  },
  {
    title: "Fast by default",
    body: "Updates apply optimistically. Layout does not shift when data arrives. Search results update on every keystroke.",
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
  { name: "Accent", varName: "--g-accent" },
  { name: "Cardinal", varName: "--g-brand" },
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
  background: var(--g-ink-3);
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

.sg-motion-play {
  align-self: flex-start;
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
  background: var(--g-ink-3);
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
.sg-sheet-demo {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.sg-sheet-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
.sg-primitives {
  width: 100%;
  border-collapse: collapse;
  font: var(--text-small);
  color: var(--g-ink-2);
}
.sg-primitives th {
  text-align: left;
  font-weight: 600;
  color: var(--g-ink);
  padding: var(--space-2) var(--space-3) var(--space-2) 0;
  border-bottom: 1px solid var(--g-line);
}
.sg-primitives td {
  padding: var(--space-2) var(--space-3) var(--space-2) 0;
  border-bottom: 1px solid var(--g-line);
  vertical-align: top;
}
.sg-primitives code {
  font: var(--text-id-small);
  color: var(--g-ink);
}
/* Too narrow for three columns: each row stacks, its labels inline. */
@media (max-width: 599px) {
  .sg-primitives thead {
    display: none;
  }
  .sg-primitives tr,
  .sg-primitives td {
    display: block;
  }
  .sg-primitives tr {
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--g-line);
  }
  .sg-primitives td {
    padding: var(--space-05) 0;
    border-bottom: none;
  }
  .sg-primitives td[data-label]::before {
    content: attr(data-label) ": ";
    font-weight: 600;
    color: var(--g-ink);
  }
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
