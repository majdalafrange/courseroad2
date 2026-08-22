<script lang="ts" setup>
import { useRoute, useRouter } from "vue-router";

// the old path check broke under /dev, and the router already matched here.
// Query preserved, not just the path: FireRoad's OAuth callback lands here
// (VITE_URL has no path of its own) with ?code=..., and dropping it left
// attemptLogin() with nothing to redeem, re-triggering login forever.
const route = useRoute();
const router = useRouter();

router.replace({ name: "/road/[[road]]", query: route.query });
</script>
