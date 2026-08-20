<script lang="ts" setup>
import { useRouter } from "vue-router";

// the old path check broke under /dev, and the router already matched here
useRouter().replace("/road");
</script>
