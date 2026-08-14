<template>
  <svg class="glyph-field" aria-hidden="true" focusable="false">
    <defs>
      <pattern
        id="canvasGlyphTile"
        :width="TILE"
        :height="TILE"
        patternUnits="userSpaceOnUse"
      >
        <text
          v-for="(g, i) in tiled"
          :key="i"
          class="glyph"
          :x="g.x"
          :y="g.y"
          :font-size="g.s"
          :opacity="g.o"
          :transform="`rotate(${g.r} ${g.x} ${g.y})`"
        >
          {{ g.c }}
        </text>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#canvasGlyphTile)" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";

/**
 * The planning canvas material: numerals and operators used as a substance
 * rather than as labels, after the lattice of characters in the Alchemist on
 * the Stratton lawn. The technique is the borrowed part. No figure is drawn.
 *
 * Rendered as an SVG pattern rather than a background-image data URI so the
 * glyphs get the page's own Plex Mono and the theme's own tokens. The tile
 * repeats to any height, and living inside the scrolled content means the
 * field moves with the plan the way the old contour paper did.
 */

interface Glyph {
  /** Character to draw. */
  c: string;
  x: number;
  y: number;
  /** Font size in user units. */
  s: number;
  /** Rotation in degrees about (x, y). */
  r: number;
  /** Per-glyph opacity, so the field reads as layered depth. */
  o: number;
}

const TILE = 220;

/**
 * Laid out on a jittered grid at roughly 31px pitch. Even coverage is the
 * point: the sculpture's characters interlock into a fabric, and a loose
 * scatter of large numerals reads as wallpaper instead. Small and packed,
 * so the field is a material the cards sit on rather than something to read.
 */
const GLYPHS: Glyph[] = [
  { c: "8", x: 12, y: 18, s: 17, r: -14, o: 0.85 },
  { c: "√", x: 47, y: 24, s: 13, r: 38, o: 0.6 },
  { c: "3", x: 74, y: 15, s: 15, r: 9, o: 0.75 },
  { c: "+", x: 105, y: 26, s: 11, r: -31, o: 0.5 },
  { c: "0", x: 134, y: 16, s: 18, r: 21, o: 0.85 },
  { c: "π", x: 165, y: 27, s: 14, r: -7, o: 0.65 },
  { c: "5", x: 196, y: 17, s: 16, r: 44, o: 0.75 },

  { c: "≈", x: 17, y: 52, s: 11, r: 63, o: 0.5 },
  { c: "1", x: 44, y: 60, s: 18, r: -19, o: 0.85 },
  { c: "∂", x: 77, y: 49, s: 13, r: 12, o: 0.6 },
  { c: "×", x: 108, y: 58, s: 11, r: 47, o: 0.5 },
  { c: "6", x: 137, y: 51, s: 17, r: -24, o: 0.8 },
  { c: "Δ", x: 168, y: 60, s: 14, r: 15, o: 0.65 },
  { c: "9", x: 199, y: 50, s: 16, r: 34, o: 0.8 },

  { c: "=", x: 14, y: 88, s: 11, r: -54, o: 0.5 },
  { c: "4", x: 43, y: 80, s: 18, r: 7, o: 0.85 },
  { c: "∑", x: 73, y: 91, s: 14, r: -36, o: 0.6 },
  { c: "7", x: 104, y: 82, s: 16, r: 22, o: 0.8 },
  { c: "∞", x: 135, y: 92, s: 12, r: -9, o: 0.5 },
  { c: "2", x: 164, y: 81, s: 17, r: 29, o: 0.85 },
  { c: "∫", x: 196, y: 90, s: 15, r: -15, o: 0.6 },

  { c: "5", x: 19, y: 118, s: 14, r: 57, o: 0.7 },
  { c: "−", x: 48, y: 112, s: 11, r: 23, o: 0.5 },
  { c: "8", x: 76, y: 122, s: 18, r: -32, o: 0.85 },
  { c: "≤", x: 107, y: 113, s: 11, r: 11, o: 0.5 },
  { c: "3", x: 136, y: 123, s: 16, r: 43, o: 0.8 },
  { c: "÷", x: 167, y: 112, s: 11, r: -21, o: 0.5 },
  { c: "0", x: 197, y: 121, s: 17, r: 17, o: 0.85 },

  { c: "1", x: 13, y: 150, s: 17, r: -27, o: 0.85 },
  { c: "≥", x: 45, y: 143, s: 11, r: 37, o: 0.5 },
  { c: "7", x: 74, y: 153, s: 15, r: 13, o: 0.75 },
  { c: "π", x: 105, y: 144, s: 13, r: -46, o: 0.6 },
  { c: "9", x: 134, y: 154, s: 18, r: 25, o: 0.85 },
  { c: "√", x: 166, y: 143, s: 12, r: -11, o: 0.55 },
  { c: "4", x: 196, y: 152, s: 16, r: 49, o: 0.8 },

  { c: "≠", x: 18, y: 182, s: 11, r: 5, o: 0.5 },
  { c: "6", x: 46, y: 174, s: 17, r: -17, o: 0.85 },
  { c: "∑", x: 76, y: 184, s: 14, r: 19, o: 0.6 },
  { c: "2", x: 106, y: 175, s: 16, r: -37, o: 0.8 },
  { c: "Δ", x: 137, y: 185, s: 13, r: 28, o: 0.6 },
  { c: "8", x: 166, y: 174, s: 18, r: -6, o: 0.85 },
  { c: "×", x: 198, y: 183, s: 11, r: 51, o: 0.5 },

  { c: "∂", x: 15, y: 210, s: 13, r: -25, o: 0.6 },
  { c: "5", x: 45, y: 204, s: 16, r: 15, o: 0.8 },
  { c: "∫", x: 75, y: 213, s: 14, r: 33, o: 0.6 },
  { c: "3", x: 105, y: 205, s: 17, r: -13, o: 0.85 },
  { c: "≈", x: 136, y: 214, s: 11, r: 41, o: 0.5 },
  { c: "0", x: 166, y: 204, s: 16, r: 8, o: 0.8 },
  { c: "7", x: 197, y: 212, s: 15, r: -29, o: 0.75 },
];

/**
 * A pattern tile clips whatever crosses its edge, so any glyph near one is
 * emitted again on the opposite side. Without this the field shows a faint
 * grid of empty gutters at the tile seams.
 */
const tiled = computed<Glyph[]>(() => {
  const out: Glyph[] = [];
  for (const g of GLYPHS) {
    const reach = g.s * 1.15;
    const xs = [0];
    const ys = [0];
    if (g.x - reach < 0) {
      xs.push(TILE);
    }
    if (g.x + reach > TILE) {
      xs.push(-TILE);
    }
    if (g.y - reach < 0) {
      ys.push(TILE);
    }
    if (g.y + reach > TILE) {
      ys.push(-TILE);
    }
    for (const dx of xs) {
      for (const dy of ys) {
        out.push({ ...g, x: g.x + dx, y: g.y + dy });
      }
    }
  }
  return out;
});
</script>

<style scoped>
.glyph-field {
  position: absolute;
  /* The field reaches back across the canvas padding (the --canvas-pad-*
     vars sit beside that padding in MainPage.vue), so the material meets
     every edge of the scrollable area instead of leaving a bare frame
     where the page background showed through. Sized with calc rather
     than opposing insets: an SVG is a replaced element, so left+right
     with an auto width collapses it to its intrinsic size. It still
     lives inside the scrolled sheet, so it moves with the plan. */
  top: calc(-1 * var(--canvas-pad-top, 0px));
  left: calc(-1 * var(--canvas-pad-x, 0px));
  width: calc(100% + 2 * var(--canvas-pad-x, 0px));
  height: calc(
    100% + var(--canvas-pad-top, 0px) + var(--canvas-pad-bottom, 0px)
  );
  pointer-events: none;
  /* Behind every card, banner, and drop hint in the canvas. */
  z-index: 0;
}
/* fill sits on the glyphs themselves: pattern content is its own rendering
   context and does not inherit paint from the <svg> that references it. */
.glyph {
  font-family: var(--font-mono);
  font-weight: 500;
  fill: var(--canvas-glyph);
}
</style>
