<template>
  <foreignObject
    :x="node.x - width / 2"
    :y="node.y - height / 2"
    :width="width"
    :height="height"
    class="node-slot"
  >
    <div
      xmlns="http://www.w3.org/1999/xhtml"
      class="node"
      :class="{
        anchor: node.landmark,
        focused: node.focused,
        hovered: node.hovered,
        dimmed: node.dimmed,
        pinned: node.pinned,
        stale: !node.offered,
        added: node.justAdded,
        compact,
      }"
      :style="nodeStyle"
      :data-cy="`connectionNode_${node.id.replace('.', '_')}`"
      role="button"
      :tabindex="0"
      :aria-label="ariaLabel"
      :aria-pressed="node.focused"
      @pointerdown.stop="emit('pointerdown', $event)"
      @dblclick.stop="emit('toggle')"
      @pointerenter="emit('hover', true)"
      @pointerleave="emit('hover', false)"
      @keydown="onKeydown"
    >
      <div class="node-body">
        <div class="node-headline">
          <span class="node-id">{{ node.id }}</span>
          <span v-if="node.pinned" class="node-flag" title="Pinned" />
        </div>
        <div v-if="!compact" class="node-title" :title="node.subject.title">
          {{ node.subject.title }}
        </div>
        <div v-if="!compact && facts.length" class="node-facts">
          <template v-for="(fact, i) in facts" :key="fact.text"
            ><span v-if="i > 0"> · </span
            ><span :class="{ 'fact-warn': fact.warn }">{{
              fact.text
            }}</span></template
          >
        </div>
      </div>
      <!-- dblclick.stop: two fast clicks here mean two toggles, not a
           third from the card's own double-click handler -->
      <button
        class="node-expand"
        :title="expandTitle"
        :aria-label="expandTitle"
        @pointerdown.stop
        @dblclick.stop
        @click.stop="emit('toggle')"
      >
        {{ node.expanded && !node.hasMore ? "–" : "+" }}
      </button>
    </div>
  </foreignObject>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  NODE_HEIGHT,
  NODE_HEIGHT_COMPACT,
  NODE_WIDTH,
  type NodeView,
} from "../../stores/connections";

const props = defineProps<{
  node: NodeView;
  compact: boolean;
}>();

const emit = defineEmits<{
  (e: "pointerdown", event: PointerEvent): void;
  (e: "toggle"): void;
  (e: "open"): void;
  (e: "add"): void;
  (e: "pin"): void;
  (e: "remove"): void;
  (e: "collapse"): void;
  (e: "hover", hovering: boolean): void;
}>();

const width = NODE_WIDTH;
const height = computed(() =>
  props.compact ? NODE_HEIGHT_COMPACT : NODE_HEIGHT,
);

/**
 * Department hue, plus the decorative entrance: a freshly revealed node
 * starts at the node that revealed it, settling into its final position
 * one beat after its stronger siblings. Never load-bearing.
 */
const nodeStyle = computed(() => {
  const style: Record<string, string> = { "--dept-color": props.node.color };
  const reveal = props.node.reveal;
  if (props.node.justAdded && reveal !== undefined) {
    style["--reveal-dx"] = `${reveal.dx}px`;
    style["--reveal-dy"] = `${reveal.dy}px`;
    style["--reveal-delay"] = `${reveal.delay}ms`;
  }
  return style;
});

const expandTitle = computed(() => {
  if (props.node.expanded) {
    return props.node.hasMore ? "Show more connections" : "Collapse";
  }
  return "Expand connections";
});

/**
 * Status renders as one quiet fact line. Warn ink marks offering doubt,
 * the one exception here; membership and readiness are the normal case
 * and stay neutral.
 */
const facts = computed<{ text: string; warn?: boolean }[]>(() => {
  const out: { text: string; warn?: boolean }[] = [];
  if (props.node.status) {
    out.push({ text: props.node.status === "taken" ? "Taken" : "Planned" });
  } else if (props.node.readinessLabel) {
    out.push({ text: props.node.readinessLabel });
  }
  if (props.node.requirementBadge) {
    out.push({ text: props.node.requirementBadge });
  }
  if (!props.node.offered) {
    out.push({ text: "not offered", warn: true });
  }
  return out;
});

const ariaLabel = computed(() => {
  const parts = [props.node.id, props.node.subject.title];
  if (props.node.status) {
    parts.push(props.node.status);
  } else if (props.node.anchor) {
    parts.push("starting point");
  }
  if (props.node.readinessLabel) {
    parts.push(props.node.readinessLabel);
  }
  if (props.node.requirementBadge) {
    parts.push(props.node.requirementBadge);
  }
  if (!props.node.offered) {
    parts.push("no longer offered");
  }
  parts.push(
    props.node.expanded ? "expanded" : "press Enter to expand connections",
  );
  return parts.join(", ");
});

/** Keyboard shortcuts mirror the side panel so the graph is operable. */
function onKeydown(event: KeyboardEvent) {
  // A modified chord (Cmd/Ctrl/Alt+<letter>) is the browser's or OS's,
  // not this node's: without this, Cmd+A on a focused card opened the
  // term-placement flow instead of "select all".
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  switch (event.key) {
    case "Enter":
    case " ":
      event.preventDefault();
      emit("toggle");
      break;
    case "o":
      emit("open");
      break;
    case "a":
      emit("add");
      break;
    case "p":
      emit("pin");
      break;
    case "Backspace":
    case "Delete":
      event.preventDefault();
      emit("remove");
      break;
    case "c":
      emit("collapse");
      break;
  }
}
</script>

<style scoped>
.node-slot {
  overflow: visible;
}
.node {
  box-sizing: border-box;
  display: flex;
  align-items: stretch;
  width: 100%;
  height: 100%;
  background: var(--g-surface);
  /* the outline carries the department, so the card is identifiable as a
     whole shape at any zoom. It rests mixed toward the hairline and takes
     full chroma on interaction (the shared --dept-rest recipe). */
  border: 1.5px solid
    color-mix(
      in srgb,
      var(--dept-color, var(--g-line-strong)) var(--dept-rest-mix),
      var(--g-line-strong)
    );
  /* a stadium, like the chips it carries; edge trimming assumes the caps */
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-1);
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  transition:
    box-shadow var(--motion-quick) var(--ease-out),
    border-color var(--motion-quick) var(--ease-out),
    opacity var(--motion-standard) var(--ease-out),
    transform var(--motion-quick) var(--ease-out);
}
/* pointing at it (here or at its side-panel row) brings the department to
   full chroma and lifts the card */
.node:hover,
.node.hovered {
  border-color: var(--dept-color, var(--g-line-strong));
  box-shadow: var(--shadow-2);
}
/* outside the emphasized neighborhood: recede, never move */
.node.dimmed {
  opacity: 0.38;
}
.node:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
/* a starting point carries the tint alone; the fact is encoded once */
.node.anchor {
  background: var(--g-accent-tint);
}
/* selection rings the card from outside, with a gap so the accent and the
   department outline never blend into one muddy edge (the --g-focus-ring
   construction). The department survives being selected. */
.node.focused {
  border-color: var(--dept-color, var(--g-line-strong));
  box-shadow:
    0 0 0 1.5px var(--g-bg),
    0 0 0 3.5px var(--g-accent),
    var(--shadow-2);
}
.node.stale {
  border-style: dashed;
  opacity: 0.82;
}

/* the left padding clears the cap's curve, so the top and bottom lines
   don't run into the rounded edge */
.node-body {
  flex: 1;
  min-width: 0;
  padding: 6px 4px 6px 18px;
  display: flex;
  flex-direction: column;
  gap: var(--space-05);
}
.compact .node-body {
  justify-content: center;
  padding: 4px 4px 4px 14px;
}
.node-headline {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.node-id {
  font: var(--text-id-small);
  font-family: var(--font-mono);
  color: var(--g-ink);
  font-weight: 600;
}
.node-flag {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--g-accent);
  flex-shrink: 0;
}
.node-title {
  font: var(--text-small);
  color: var(--g-ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* one line; a fact that cannot fit yields to the panel rather than wrap
   into a clipped fourth line */
.node-facts {
  font: var(--text-micro);
  color: var(--g-ink-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}
.fact-warn {
  color: var(--g-warn);
}

/* a round control in the cap, matching the stadium */
.node-expand {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  align-self: center;
  margin: 0 6px 0 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--g-line);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--g-ink-3);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition: background-color var(--motion-quick) var(--ease-out);
}
.node-expand:hover {
  background: var(--g-accent-tint);
  border-color: var(--g-accent);
  color: var(--g-accent);
}

/* Decorative entrance for freshly revealed nodes: settle in from the node
   that revealed them, staggered strongest-first. Positions are final before
   the animation starts; it is never load-bearing. */
.node.added {
  animation: node-settle 340ms var(--ease-settle);
  animation-delay: var(--reveal-delay, 0ms);
  animation-fill-mode: backwards;
}
@keyframes node-settle {
  from {
    transform: translate(var(--reveal-dx, 0px), var(--reveal-dy, 0px))
      scale(0.6);
    opacity: 0;
  }
  60% {
    opacity: 1;
  }
  to {
    transform: translate(0, 0) scale(1);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .node.added {
    animation: none;
  }
  .node {
    transition: none;
  }
}
</style>
