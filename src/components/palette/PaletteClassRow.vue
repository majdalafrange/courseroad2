<template>
  <!-- One class in the palette's results (search results, favorites).
       Listeners and attrs (pointerdown for dragging, data-cy) fall through
       to the item. Styled by CommandPalette's .palette rules. -->
  <g-combobox-item
    :value="value"
    class="palette-row class-row"
    @select="emit('select')"
  >
    <span class="row-dept" :style="{ '--dept-color': courseColor(subject) }" />
    <span class="row-id">{{ subject.subject_id }}</span>
    <span class="row-main">
      <span class="row-title">{{ subject.title }}</span>
      <span class="row-sub">
        <template v-if="subject.total_units !== undefined"
          ><span aria-hidden="true">{{ subject.total_units }}u</span
          ><span class="sr-only"
            >{{ subject.total_units }} units</span
          ></template
        >
        <template v-if="termBadges">
          <span class="sep spaced">·</span>{{ termBadges }}
        </template>
        <template v-if="subject.rating">
          <span class="sep spaced">·</span
          ><g-icon name="star" :size="10" class="rating-icon" /><span
            class="sr-only"
            >rated</span
          >
          {{ subject.rating.toFixed(1) }}
        </template>
        <template v-if="hoursLabel">
          <span class="sep spaced">·</span
          ><span aria-hidden="true">{{ hoursLabel }}h/wk</span
          ><span class="sr-only">{{ hoursLabel }} hours per week</span>
        </template>
      </span>
    </span>
    <span v-if="highlighted" class="row-place" aria-hidden="true">
      <g-kbd :keys="['Enter']" /> open <span class="sep">·</span>
      <g-kbd :keys="['Tab']" />
      place
    </span>
  </g-combobox-item>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { GComboboxItem } from "../../design/components/GCombobox";
import GIcon from "../../design/components/GIcon.vue";
import GKbd from "../../design/components/GKbd.vue";
import { courseColor } from "../../lib/colors";
import { subjectHoursLabel } from "../../lib/hours";
import { offeredSeasonLetters } from "../../lib/offering";
import type { Subject } from "../../lib/types";

const props = defineProps<{
  subject: Subject;
  /** The combobox value: unique across the whole list. */
  value: string;
  /** Highlighted: shows the Enter / Tab hint. */
  highlighted: boolean;
}>();

const emit = defineEmits<{
  (e: "select"): void;
}>();

const termBadges = computed(() =>
  offeredSeasonLetters(props.subject).join("/"),
);
const hoursLabel = computed(() => subjectHoursLabel(props.subject));
</script>
