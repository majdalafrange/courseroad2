<script lang="ts" setup>
import { useRouter } from "vue-router";
const router = useRouter();

router.replace({ name: "/road/[[road]]" });
</script>
