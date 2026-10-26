<script lang="ts" setup>
// Query preserved, not just the path: FireRoad's OAuth callback lands
// here with ?code=..., and dropping it left attemptLogin() with nothing
// to redeem.
definePage({
  redirect: (to) => ({
    path: "/road/[[road]]",
    query: to.query,
  }),
});
</script>
