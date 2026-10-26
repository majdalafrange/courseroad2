<template>
  <BaseSheet v-model="isOpen" label="About" width="720px">
    <div class="about-content">
      <div class="about">
        <BaseWordmark size="lg" />
        <p class="about-lede">
          CourseRoad is a student-run academic planner for MIT students. It
          allows students to plan out their degrees, test out paths for
          different majors, and view class information. CourseRoad is maintained
          by the
          <BaseLink href="https://sipb.mit.edu" external
            >Student Information Processing Board</BaseLink
          >.
        </p>
        <p>
          It uses
          <BaseLink href="https://fireroad.mit.edu" external>FireRoad</BaseLink
          >, which provides the subject catalog, the requirements engine, and
          cloud sync.
        </p>

        <h2>Disclaimer</h2>
        <p>
          This is an unofficial tool and is always a work in progress! It's
          never going to be perfect, because the audit is presented in English,
          which allows unlimited flexibility and annoying edge cases. Always
          double-check with the
          <BaseLink href="https://student.mit.edu/cgi-bin/shrwsdau.sh" external
            >official audit</BaseLink
          >, the
          <BaseLink href="https://catalog.mit.edu/degree-charts/" external
            >degree charts</BaseLink
          >, and your department advisor.
        </p>
        <p>
          This version of CourseRoad has a rebuilt interface. Generative AI has
          been used in the development of the user interface, but it has not
          been used for any of the logic or data processing. All course and
          requirement data is sourced from MIT's official resources.
        </p>
        <!-- TODO: change url before launch -->
        <p>
          If you would like to access the old version of CourseRoad, you can
          find it at
          <BaseLink href="https://courseroad.mit.edu/" external
            >courseroad.mit.edu</BaseLink
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
          <BaseLink href="https://github.com/sipb/courseroad2" external
            >GitHub</BaseLink
          >, and we gladly accept contributions. If you have any questions,
          comments, or just want to say hi, feel free to email us at
          <BaseLink href="mailto:courseroad@mit.edu"
            >courseroad@mit.edu</BaseLink
          >. If you spot a requirement that's wrong, you can fix it by going to
          the
          <BaseLink href="https://fireroad.mit.edu/requirements/" external
            >requirements editor</BaseLink
          >.
        </p>
      </div>
    </div>
  </BaseSheet>
</template>

<script setup lang="ts">
import BaseSheet from "../../design/components/BaseSheet.vue";
import BaseLink from "../../design/components/BaseLink.vue";
import BaseWordmark from "../../design/components/BaseWordmark.vue";

const isOpen = defineModel<boolean>({ required: true });
</script>

<style scoped>
.about-content {
  overflow-y: auto;
  padding: var(--space-6);
  font: var(--text-body);
  color: var(--base-ink);
}
.about {
  max-width: 46em;
  color: var(--base-ink);
}
/* .about p is (0,1,1); this has to outrank it or the lede renders as body */
.about p.about-lede {
  font: var(--text-heading);
  font-weight: 400;
  color: var(--base-ink);
  margin: var(--space-4) 0 var(--space-5);
}
.about h2 {
  font: var(--text-heading);
  margin: var(--space-4) 0 var(--space-2);
}
.about p {
  font: var(--text-body);
  color: var(--base-ink-2);
  margin: 0 0 var(--space-2);
}
/* Names in two columns where they fit, so the list doesn't outgrow the
   sheet; a phone gets one. */
.about ul {
  columns: 2 14em;
  column-gap: var(--space-6);
  margin: 0 0 var(--space-3);
  padding-left: var(--space-5);
  color: var(--base-ink-2);
}
.about li {
  margin: 0 0 var(--space-05);
  break-inside: avoid;
}
.about-credits {
  font: var(--text-small);
  color: var(--base-ink-3);
}
</style>
