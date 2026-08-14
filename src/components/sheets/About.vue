<template>
  <div class="about">
    <g-wordmark size="lg" />
    <p class="about-lede">
      CourseRoad is a student-run degree planner for MIT students. Lay out every
      class across your whole time here, keep an eye on your progress toward
      your majors and minors, and it'll sync to the cloud so it's there whenever
      you need it. CourseRoad is maintained by the
      <a href="https://sipb.mit.edu" target="_blank" rel="noopener"
        >Student Information Processing Board</a
      >
      with help from the Office of the First Year.
    </p>
    <p>
      It runs on
      <a href="https://fireroad.mit.edu" target="_blank" rel="noopener"
        >FireRoad</a
      >, which provides the subject catalog, the requirements engine, and cloud
      sync.
    </p>

    <h2>Disclaimer</h2>
    <p>
      This is an unofficial tool. The audit does its best to read requirements
      written in English, so it won't always get edge cases right. Always
      double-check with the
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
      Spot a requirement that's wrong? You can fix it yourself at the source in
      the
      <a
        href="https://fireroad.mit.edu/requirements/"
        target="_blank"
        rel="noopener"
        >requirements editor</a
      >.
    </p>

    <h2>Built by</h2>
    <p class="about-credits">
      A long line of student volunteers has kept CourseRoad going, including
      Nate Foss (npfoss), Alice Nguyen (mwnguyen), Miriam Rittenberg (mrittenb),
      Timmy Xiao (mitimmy), Maximo Machado (maximo), Georgia Shay (gshay), Amani
      Toussaint (amanit), Sophie Mori (ksmori), and Danny Ben-David (dannybd).
      It's open source on
      <a
        href="https://github.com/sipb/courseroad2"
        target="_blank"
        rel="noopener"
        >GitHub</a
      >, and we'd love your contributions.
    </p>
    <p>
      Questions, comments, or just want to say hi? Email us at
      <a href="mailto:courseroad@mit.edu">courseroad@mit.edu</a>.
    </p>
  </div>
</template>

<script setup lang="ts">
import GWordmark from "../../design/components/GWordmark.vue";
</script>

<style scoped>
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
