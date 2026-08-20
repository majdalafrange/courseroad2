<script lang="ts" setup>
import { useRouter } from "vue-router";
const router = useRouter();

if (window.location.pathname === "/") {
  router.replace("/road");
}
</script>
