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
          <a href="https://sipb.mit.edu" target="_blank" rel="noopener"
            >Student Information Processing Board</a
          >
          with help from the Office of the First Year.
        </p>
        <p>
          It utilizes
          <a href="https://fireroad.mit.edu" target="_blank" rel="noopener"
            >FireRoad</a
          >, which provides the subject catalog, the requirements engine, and
          cloud sync.
        </p>

        <h2>Disclaimer</h2>
        <p>
          This is an unofficial tool. It's never going to be perfect, because
          the audit is presented in English, which allows unlimited flexibility
          and annoying edge cases. Always double-check with the
          <a
            href="https://student.mit.edu/cgi-bin/shrwsdau.sh"
            target="_blank"
            rel="noopener"
            >official audit</a
          >, the
          <a
            href="https://catalog.mit.edu/degree-charts/"
            target="_blank"
            rel="noopener"
            >degree charts</a
          >, and your department advisor.
        </p>
        <p>
          Spot a requirement that's wrong? You can fix it by going to the
          <a
            href="https://fireroad.mit.edu/requirements/"
            target="_blank"
            rel="noopener"
            >requirements editor</a
          >.
        </p>

        <h2>Built by</h2>
        <p class="about-credits">
          A long line of student volunteers have helped to maintain CourseRoad,
          including:
        </p>
        <ul>
          <li>Nate Foss (npfoss)</li>
          <li>Alice Nguyen (mwnguyen)</li>
          <li>Miriam Rittenberg (mrittenb)</li>
          <li>Timmy Xiao (mitimmy)</li>
          <li>Maximo Machado (maximo)</li>
          <li>Georgia Shay (gshay)</li>
          <li>Amani Toussaint (amanit)</li>
          <li>Sophie Mori (ksmori)</li>
          <li>Danny Ben-David (dannybd)</li>
        </ul>
        <p>
          CourseRoad is fully open source on
          <a
            href="https://github.com/sipb/courseroad2"
            target="_blank"
            rel="noopener"
            >GitHub</a
          >, and we gladly accept contributions. If you have any questions,
          comments, or just want to say hi, feel free to email us at
          <a href="mailto:courseroad@mit.edu">courseroad@mit.edu</a>.
        </p>
      </div>
    </div>
  </g-sheet>
</template>

<script setup lang="ts">
import GSheet from "../../design/components/GSheet.vue";
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
  margin: var(--space-6) 0 var(--space-2);
}
.about p {
  font: var(--text-body);
  color: var(--g-ink-2);
  margin: 0 0 var(--space-3);
}
.about ul {
  margin: 0 0 var(--space-3) var(--space-1);
  color: var(--g-ink-2);
}
.about li {
  margin: 0 0 var(--space-1);
}
.about a {
  color: var(--g-accent);
  text-decoration: none;
}
.about a:hover {
  text-decoration: underline;
}
.about-credits {
  font: var(--text-small);
  color: var(--g-ink-3);
}
</style>
