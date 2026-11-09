<template>
  <v-system-bar
    v-if="!dismissed"
    app
    window
    dark
    color="#34627d"
    data-cy="betaBanner"
  >
    <v-spacer />
    <a
      href="https://courseroad.mit.edu/dev/"
      class="beta-link d-flex align-center white--text text-decoration-none"
      data-cy="betaBannerLink"
    >
      <v-icon small class="mr-1">mdi-flask-outline</v-icon>
      A new version of CourseRoad is in beta!
      <span class="mx-2 font-weight-medium text-decoration-underline">
        Try it out
      </span>
      <v-icon small class="transition-swing">mdi-arrow-right</v-icon>
    </a>
    <v-spacer />
    <v-btn
      icon
      small
      class="beta-close"
      title="Dismiss"
      aria-label="Dismiss beta announcement"
      data-cy="betaBannerDismiss"
      @click="dismiss"
    >
      <v-icon small>mdi-close</v-icon>
    </v-btn>
  </v-system-bar>
</template>

<script>
export default {
  name: "BetaBanner",
  data: function () {
    return {
      // The /dev build is the beta itself, so it never shows the banner.
      dismissed:
        import.meta.env.VITE_URL.includes("dev") ||
        this.$cookies.isKey("dismissedBetaBanner"),
    };
  },
  methods: {
    dismiss: function () {
      this.dismissed = true;
      if (this.$store.state.cookiesAllowed) {
        this.$cookies.set("dismissedBetaBanner", true, "30d");
      }
    },
  },
};
</script>

<style scoped>
.beta-link:hover .transition-swing {
  transform: translateX(3px);
}
.beta-close {
  position: absolute;
  right: 4px;
}
</style>
