<template>
  <g-sheet
    :model-value="modelValue"
    label="About"
    width="720px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="about-content">
      <div class="about">
        <g-wordmark size="lg" />
        <p class="about-lede">
          CourseRoad is a student-run academic planner for MIT students. It
          allows students to plan out their degrees, test out paths for
          different majors, and view class information. CourseRoad is maintained
          by the
          <g-link href="https://sipb.mit.edu" external
            >Student Information Processing Board</g-link
          >.
        </p>
        <p>
          It utilizes
          <g-link href="https://fireroad.mit.edu" external>FireRoad</g-link>,
          which provides the subject catalog, the requirements engine, and cloud
          sync.
        </p>

        <h2>Disclaimer</h2>
        <p>
          This is an unofficial tool and is always a work in progress! It's
          never going to be perfect, because the audit is presented in English,
          which allows unlimited flexibility and annoying edge cases. Always
          double-check with the
          <g-link href="https://student.mit.edu/cgi-bin/shrwsdau.sh" external
            >official audit</g-link
          >, the
          <g-link href="https://catalog.mit.edu/degree-charts/" external
            >degree charts</g-link
          >, and your department advisor.
        </p>
        <p>
          For this new iteration of CourseRoad, we've made significant
          improvements to the user experience and the underlying structure.
          Generative AI has been used in the development of the user interface,
          but it has not been used for any of the logic or data processing. All
          course and requirement data is sourced from MIT's official resources.
        </p>
        <!-- TODO: change url before launch -->
        <p>
          If you would like to access the old version of CourseRoad, you can
          find it at
          <g-link href="https://courseroad.mit.edu/" external
            >courseroad.mit.edu</g-link
          >.
        </p>

        <h2>Built by</h2>
        <p class="about-credits">
          A long line of student volunteers have helped to maintain CourseRoad,
          including:
        </p>
        <ul>
          <li>Danny Ben-David (dannybd)</li>
          <li>Sophie Mori (ksmori)</li>
          <li>Nate Foss (npfoss)</li>
          <li>Alice Nguyen (mwnguyen)</li>
          <li>Miriam Rittenberg (mrittenb)</li>
          <li>Timmy Xiao (mitimmy)</li>
          <li>Maximo Machado (maximo)</li>
          <li>Georgia Shay (gshay)</li>
          <li>Amani Toussaint (amanit)</li>
          <li>Diego Temkin (dtemkin)</li>
          <li>Pratyush Venkatakrishnan (psvenk)</li>
          <li>Majd Alafrange (majd)</li>
        </ul>
        <p>
          CourseRoad is fully open source on
          <g-link href="https://github.com/sipb/courseroad2" external
            >GitHub</g-link
          >, and we gladly accept contributions. If you have any questions,
          comments, or just want to say hi, feel free to email us at
          <g-link href="mailto:courseroad@mit.edu">courseroad@mit.edu</g-link>.
          If you spot a requirement that's wrong, you can fix it by going to the
          <g-link href="https://fireroad.mit.edu/requirements/" external
            >requirements editor</g-link
          >.
        </p>
      </div>
    </div>
  </g-sheet>
</template>

<script setup lang="ts">
import GSheet from "../../design/components/GSheet.vue";
import GLink from "../../design/components/GLink.vue";
import GWordmark from "../../design/components/GWordmark.vue";

defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();
</script>

<style scoped>
.about-content {
  overflow-y: auto;
  padding: var(--space-6);
  font: var(--text-body);
  color: var(--g-ink);
}
.about {
  max-width: 46em;
  color: var(--g-ink);
}
.about-lede {
  font: var(--text-title);
  font-weight: 400;
  color: var(--g-ink-2);
  margin: var(--space-4) 0 var(--space-6);
}
.about h2 {
  font: var(--text-heading);
  margin: var(--space-4) 0 var(--space-2);
}
.about p {
  font: var(--text-body);
  color: var(--g-ink-2);
  margin: 0 0 var(--space-2);
}
.about ul {
  margin: 0 0 var(--space-2) var(--space-1);
  color: var(--g-ink-2);
}
.about li {
  margin: 0 0 var(--space-05);
}
.about-credits {
  font: var(--text-small);
  color: var(--g-ink-3);
}
</style>
