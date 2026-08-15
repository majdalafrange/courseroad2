<template>
  <section
    class="program"
    :class="{
      'is-preview': preview,
      'just-completed': celebrating,
      'is-ledger': collapsed,
    }"
  >
    <header
      class="program-head"
      :role="collapsed ? undefined : 'button'"
      :tabindex="collapsed ? undefined : 0"
      :aria-expanded="collapsed ? undefined : open"
      @click="toggleOpen"
      @keydown.enter.prevent="toggleOpen"
    >
      <svg
        class="program-ring"
        :class="{ celebrate: celebrating }"
        viewBox="0 0 36 36"
        aria-hidden="true"
      >
        <circle class="ring-track" cx="18" cy="18" r="15.5" />
        <circle
          class="ring-fill"
          :class="ringTone"
          cx="18"
          cy="18"
          r="15.5"
          :stroke-dasharray="`${ringLength} ${circumference}`"
        />
      </svg>
      <div class="program-title-block">
        <span class="program-title">{{ title }}</span>
        <span class="program-sub">
          <template v-if="preview">what if? (not saved)</template>
          <template v-else-if="tree?.fulfilled">complete</template>
          <template v-else-if="percent !== null"
            >{{ percent }}% complete</template
          >
          <template v-else-if="failed">
            progress didn't load
            <button
              class="program-retry"
              data-cy="programRetryButton"
              :aria-label="`Retry computing ${title}`"
              @click.stop="retry"
              @keydown.enter.stop
            >
              Retry
            </button>
          </template>
          <template v-else>computing...</template>
        </span>
      </div>
      <button
        v-if="!preview && !collapsed && tree"
        class="program-expandall"
        :aria-label="`${anyCollapsed ? 'Expand' : 'Collapse'} all of ${title}`"
        @click.stop="toggleAll"
        @keydown.enter.stop
      >
        {{ anyCollapsed ? "Expand all" : "Collapse all" }}
      </button>
      <span v-if="preview" class="preview-actions">
        <g-button
          size="sm"
          variant="primary"
          @click.stop="auditStore.keepPreview()"
        >
          Keep
        </g-button>
        <g-button
          size="sm"
          variant="ghost"
          @click.stop="auditStore.clearPreview()"
        >
          Discard
        </g-button>
      </span>
      <button
        v-else
        class="program-remove"
        :aria-label="`Remove ${title}`"
        data-cy="removeProgramButton"
        @click.stop="emit('remove')"
      >
        <g-icon name="close" :size="12" />
      </button>
    </header>

    <div v-if="open && !collapsed && tree" class="program-body">
      <req-node
        v-for="(child, index) in tree.reqs ?? []"
        :key="child.uniqueKey ?? index"
        :node="child"
        :depth="0"
        :program-key="programKey"
      />
      <a
        v-if="tree.url"
        class="program-link"
        :href="safeHref(tree.url)"
        target="_blank"
        rel="noopener"
        >Official {{ title }} requirements ↗</a
      >
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import GButton from "../../design/components/GButton.vue";
import GIcon from "../../design/components/GIcon.vue";
import ReqNode from "./ReqNode.vue";
import type { RequirementNode } from "../../lib/types";
import { safeHref } from "../../lib/courseLinks";
import { announce } from "../../design/announce";
import { prefersReducedMotion } from "../../design/tokens";
import { useAuditStore } from "../../stores/audit";

const props = defineProps<{
  programKey: string;
  tree: RequirementNode | null;
  title: string;
  preview?: boolean;
  startOpen?: boolean;
  /**
   * Ledger mode: hide the body without writing to `open`, so the
   * student's expansion state survives the detail closing again.
   */
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  (e: "remove"): void;
}>();

const auditStore = useAuditStore();

/* Expansion lives in the audit store so it survives the panel swapping
   between audit and class detail. The store key for a program header is
   the program key itself. */
const open = computed({
  get: () => auditStore.expanded[props.programKey] ?? props.startOpen ?? true,
  set: (value) => auditStore.setNode(props.programKey, value),
});

/* In ledger mode the header is a passive summary row; a click must not
   silently rewrite the stored expansion state. */
function toggleOpen() {
  if (props.collapsed) {
    return;
  }
  open.value = !open.value;
}

/* ---- expand all / collapse all ---- */
/* Every branch under this program with its current open state. Children
   of the tree root render at depth 0, so their default is open. Leaves
   carry no expansion state and are skipped. */
const branchStates = computed<{ key: string; open: boolean }[]>(() => {
  const list: { key: string; open: boolean }[] = [];
  const walk = (node: RequirementNode, childDepth: number) => {
    for (const child of node.reqs ?? []) {
      if (child.reqs !== undefined) {
        const key = props.programKey + "/" + (child["list-id"] ?? "");
        list.push({
          key,
          open: auditStore.expanded[key] ?? childDepth < 1,
        });
        walk(child, childDepth + 1);
      }
    }
  };
  if (props.tree !== null) {
    walk(props.tree, 0);
  }
  return list;
});

/* The label reflects the state rather than counting toggles: any closed
   branch (or a closed program) reads as "Expand all". */
const anyCollapsed = computed(
  () => !open.value || branchStates.value.some((branch) => !branch.open),
);

function toggleAll() {
  const expand = anyCollapsed.value;
  if (expand && !open.value) {
    open.value = true;
  }
  auditStore.setNodes(
    branchStates.value.map((branch) => branch.key),
    expand,
  );
}

const percent = computed(() => {
  const value = props.tree?.percent_fulfilled;
  if (value === undefined || value === "N/A") {
    return null;
  }
  return Math.round(Number(value));
});

/* A program whose progress request failed (an unresolvable key, or
   FireRoad unreachable) and that has no tree to show. A terminal state
   with a retry, where it used to read "computing..." forever. */
const failed = computed(
  () =>
    !props.preview &&
    props.tree === null &&
    auditStore.failedPrograms[props.programKey] === true,
);

function retry() {
  auditStore.updateFulfillment(props.programKey);
}

const circumference = 2 * Math.PI * 15.5;
const ringLength = computed(() =>
  percent.value === null
    ? 0
    : (Math.min(100, percent.value) / 100) * circumference,
);
const ringTone = computed(() => {
  if (props.tree?.fulfilled) {
    return "tone-ok";
  }
  return (percent.value ?? 0) > 15 ? "tone-mid" : "tone-low";
});

/* When a program crosses into "complete", let it land: a brief pulse on
   the ring and a screen-reader announcement. A requirement completing
   should feel like something. */
const celebrating = ref(false);
watch(
  () => props.tree?.fulfilled,
  (nowDone, wasDone) => {
    if (nowDone && wasDone === false && !props.preview) {
      announce(`${props.title} requirements complete`);
      if (!prefersReducedMotion()) {
        celebrating.value = true;
        setTimeout(() => {
          celebrating.value = false;
        }, 900);
      }
    }
  },
);
</script>

<style scoped>
.program {
  border: 1px solid var(--g-line);
  border-radius: var(--radius-md);
  background: var(--g-surface);
  margin-bottom: var(--space-3);
  overflow: visible;
}
.program.is-preview {
  border-style: dashed;
  border-color: var(--g-accent);
  background: var(--g-accent-tint);
}
.program.just-completed {
  animation: program-land var(--motion-deliberate) var(--ease-settle);
}
@keyframes program-land {
  0% {
    box-shadow: 0 0 0 0 var(--g-progress-tint);
  }
  40% {
    box-shadow: 0 0 0 4px var(--g-progress-tint);
    border-color: var(--g-progress);
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}
.program-ring.celebrate {
  animation: ring-pop var(--motion-deliberate) var(--ease-settle);
}
@keyframes ring-pop {
  0% {
    transform: rotate(-90deg) scale(1);
  }
  45% {
    transform: rotate(-90deg) scale(1.18);
  }
  100% {
    transform: rotate(-90deg) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .program.just-completed,
  .program-ring.celebrate {
    animation: none;
  }
}

.program-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  cursor: pointer;
  user-select: none;
}

/* Ledger density: ring 24px, tighter padding, about 50px a row. */
.program.is-ledger {
  margin-bottom: var(--space-2);
}
.program.is-ledger .program-head {
  padding: var(--space-2);
  cursor: default;
}
.program.is-ledger .program-ring {
  width: 24px;
  height: 24px;
}
.program.is-ledger .program-title {
  font: var(--text-body-strong);
  -webkit-line-clamp: 1;
  line-clamp: 1;
}
.program-head:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
  border-radius: var(--radius-md);
}

.program-ring {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  transform: rotate(-90deg);
}
.ring-track {
  fill: none;
  stroke: var(--g-line);
  stroke-width: 3.5;
}
.ring-fill {
  fill: none;
  stroke-width: 3.5;
  stroke-linecap: round;
  transition: stroke-dasharray var(--motion-deliberate) var(--ease-out);
}
.ring-fill.tone-ok {
  stroke: var(--g-progress);
}
.ring-fill.tone-mid {
  stroke: var(--g-progress);
}
.ring-fill.tone-low {
  stroke: var(--g-ink-3);
}

.program-title-block {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.program-title {
  /* the display face marks the tree's first level; branches stay Plex 14 */
  font: var(--text-heading);
  color: var(--g-ink);
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}
.program-sub {
  font: var(--text-small);
  color: var(--g-ink-3);
}
.program-retry {
  font: var(--text-small);
  color: var(--g-ink-2);
  background: transparent;
  border: none;
  padding: 0;
  margin-left: var(--space-1);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.program-retry:hover {
  color: var(--g-ink);
}
.program-retry:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
  border-radius: var(--radius-xs);
}

.preview-actions {
  display: inline-flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

/* Revealed on header hover or focus, like the remove control. */
.program-expandall {
  font: var(--text-small);
  color: var(--g-ink-3);
  background: transparent;
  border: none;
  border-radius: var(--radius-xs);
  padding: 2px var(--space-2);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity var(--motion-quick) var(--ease-out);
}
.program-head:hover .program-expandall,
.program-expandall:focus-visible {
  opacity: 1;
}
.program-expandall:hover {
  background: var(--g-accent-tint);
  color: var(--g-ink);
}
.program-expandall:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}

.program-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--g-ink-3);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--motion-quick) var(--ease-out);
}
.program-head:hover .program-remove,
.program-remove:focus-visible {
  opacity: 1;
}
.program-remove:hover {
  background: var(--g-danger-tint);
  color: var(--g-danger);
}
/* Touch: these carry no pointer-events guard, so hiding them left a live
   hit target with nothing drawn in it, and removing a program sat under
   it. Show what is already tappable. */
@media (hover: none) {
  .program-expandall,
  .program-remove {
    opacity: 1;
  }
}

.program-body {
  padding: 0 var(--space-2) var(--space-3);
}
.program-link {
  display: inline-block;
  font: var(--text-small);
  color: var(--g-ink-3);
  text-decoration: none;
  padding: var(--space-2);
}
.program-link:hover {
  color: var(--g-accent);
}
</style>
