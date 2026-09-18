<script lang="ts" setup>
import { useRoute, useRouter } from "vue-router";

// Query preserved, not just the path: FireRoad's OAuth callback lands
// here with ?code=..., and dropping it left attemptLogin() with nothing
// to redeem.
const route = useRoute();
const router = useRouter();

router.replace({ name: "/road/[[road]]", query: route.query });
</script>
