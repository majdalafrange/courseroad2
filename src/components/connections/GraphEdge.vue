<template>
  <g
    class="edge"
    :class="[
      `t-${edge.primaryType}`,
      {
        crossing: edge.crossing,
        dim,
        active: edge.active,
        dimmed: edge.dimmed,
        entering: edge.entering,
      },
    ]"
  >
    <line
      class="edge-line"
      :x1="edge.x1"
      :y1="edge.y1"
      :x2="edge.x2"
      :y2="edge.y2"
    />
    <polyline v-if="arrowPoints" class="edge-arrow" :points="arrowPoints" />
    <!-- wide invisible hit area so "why are these connected?" is one hover away -->
    <line
      class="edge-hit"
      :x1="edge.x1"
      :y1="edge.y1"
      :x2="edge.x2"
      :y2="edge.y2"
      @pointerenter="emit('enter', edge, $event)"
      @pointermove="emit('move', $event)"
      @pointerleave="emit('leave')"
    />
  </g>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { EdgeView } from "../../stores/connections";

const props = withDefaults(
  defineProps<{
    edge: EdgeView;
    dim?: boolean;
  }>(),
  { dim: false },
);

const emit = defineEmits<{
  (e: "enter", edge: EdgeView, event: PointerEvent): void;
  (e: "move", event: PointerEvent): void;
  (e: "leave"): void;
}>();

/** A small arrowhead whose tip sits exactly where the edge meets the
 *  dependent card's boundary (the segment is pre-trimmed by the store). */
const arrowPoints = computed(() => {
  const a = props.edge.arrow;
  if (a === undefined) {
    return undefined;
  }
  const dx = a.toX - a.fromX;
  const dy = a.toY - a.fromY;
  const len = Math.hypot(dx, dy);
  if (len < 1) {
    return undefined;
  }
  const ux = dx / len;
  const uy = dy / len;
  const tipX = a.toX;
  const tipY = a.toY;
  const size = 9;
  const leftX = tipX - ux * size - uy * size * 0.6;
  const leftY = tipY - uy * size + ux * size * 0.6;
  const rightX = tipX - ux * size + uy * size * 0.6;
  const rightY = tipY - uy * size - ux * size * 0.6;
  return `${leftX},${leftY} ${tipX},${tipY} ${rightX},${rightY}`;
});
</script>

<style scoped>
/* Full chroma is an interaction state, not a resting state (the
   department-rail recipe): at rest an edge leans toward the hairline color,
   and emphasis restores the legend hue. */
.edge {
  --edge-rest: color-mix(
    in srgb,
    var(--edge-color, var(--g-ink-3)) 55%,
    var(--g-line-strong)
  );
}
.edge .edge-line {
  stroke: var(--edge-rest);
  stroke-width: 1.5;
  opacity: 0.6;
  transition:
    stroke var(--motion-quick) var(--ease-out),
    opacity var(--motion-standard) var(--ease-out);
}
.edge-arrow {
  fill: none;
  stroke: var(--edge-rest);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.75;
  transition:
    stroke var(--motion-quick) var(--ease-out),
    opacity var(--motion-standard) var(--ease-out);
}
.edge-hit {
  stroke: transparent;
  stroke-width: 16;
  opacity: 1;
  cursor: help;
}
.edge.dim .edge-line,
.edge.dim .edge-arrow {
  opacity: 0.16;
}

/* the emphasized node's own connections come forward… */
.edge.active .edge-line {
  stroke: var(--edge-color, var(--g-ink-3));
  stroke-width: 2.5;
  opacity: 0.92;
}
.edge.active .edge-arrow {
  stroke: var(--edge-color, var(--g-ink-3));
  opacity: 1;
}
/* …everything else recedes (opacity only, nothing moves) */
.edge.dimmed .edge-line,
.edge.dimmed .edge-arrow {
  opacity: 0.14;
}

/* freshly revealed edges fade in after their endpoints land */
.edge.entering .edge-line,
.edge.entering .edge-arrow {
  animation: edge-in 300ms var(--ease-out);
  animation-delay: 320ms;
  animation-fill-mode: backwards;
}
@keyframes edge-in {
  from {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .edge.entering .edge-line,
  .edge.entering .edge-arrow {
    animation: none;
  }
  .edge .edge-line,
  .edge-arrow {
    transition: none;
  }
}

/* relationship colors (theme-aware via tokens) */
.t-prereq {
  --edge-color: var(--g-accent);
}

/* interdisciplinary crossings are the point: heavier line, warmer rest mix */
.edge.crossing {
  --edge-rest: color-mix(
    in srgb,
    var(--edge-color, var(--g-ink-3)) 80%,
    var(--g-line-strong)
  );
}
.edge.crossing .edge-line {
  stroke-width: 2.25;
  opacity: 0.8;
}
.edge.crossing.active .edge-line {
  stroke-width: 2.75;
  opacity: 0.95;
}
.edge.crossing.dimmed .edge-line {
  opacity: 0.14;
}
</style>
