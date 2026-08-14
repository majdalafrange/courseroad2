<template>
  <div class="about">
    <g-wordmark size="lg" />
    <p class="about-lede">
      CourseRoad is a degree planner for MIT students. Lay out every class
      across your whole time here, watch your progress against the official
      requirements, and sync it to the cloud.
    </p>

    <h2>Lineage</h2>
    <p>
      CourseRoad is the student-run planner maintained for years by the
      <a href="https://sipb.mit.edu" target="_blank" rel="noopener"
        >Student Information Processing Board</a
      >
      and the Office of the First Year. This release is a ground-up redesign.
      Every road you've ever saved still loads here. The interface is new. The
      requirements engine is the same one, along with the years of student bug
      reports that shaped it.
    </p>
    <p>
      It runs on
      <a href="https://fireroad.mit.edu" target="_blank" rel="noopener"
        >FireRoad</a
      >, which provides the subject catalog, the requirements engine, and cloud
      sync. FireRoad also makes a mobile app, available for
      <a
        href="https://itunes.apple.com/us/app/fireroad-mit-course-planner/id1330678450"
        target="_blank"
        rel="noopener"
        >iOS</a
      >
      or
      <a
        href="https://play.google.com/store/apps/details?id=com.base12innovations.android.fireroad&hl=en_US"
        target="_blank"
        rel="noopener"
        >Android</a
      >.
    </p>

    <h2>Disclaimer</h2>
    <p>
      This is an unofficial tool. The audit is a best-effort reading of
      requirements written in English, so edge cases happen. Always confirm with
      the
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
      >, and your department advisor. Spot a wrong requirement? Fix it at the
      source in the
      <a
        href="https://fireroad.mit.edu/requirements/"
        target="_blank"
        rel="noopener"
        >requirements editor</a
      >.
    </p>

    <h2>Migrating from old CourseRoad</h2>
    <p>
      The previous version lives on at
      <a href="https://courseroad.mit.edu/old" target="_blank" rel="noopener"
        >courseroad.mit.edu/old</a
      >. Export your roads there, then import them here from Share → Import to
      bring your data across.
    </p>

    <h2>Built by</h2>
    <p class="about-credits">
      A long line of student volunteers, including Nate Foss, Alice Nguyen,
      Miriam Rittenberg, Timmy Xiao, Maximo Machado, Georgia Shay, Amani
      Toussaint, Sophie Mori, and Danny Ben-David. It's open source on
      <a
        href="https://github.com/sipb/courseroad2"
        target="_blank"
        rel="noopener"
        >GitHub</a
      >. Contributions welcome.
    </p>
    <p>
      Questions or comments?
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
