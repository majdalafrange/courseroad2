<template>
  <teleport to="body">
    <div class="detail-scrim" @click.self="emit('close')">
      <div
        class="detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Class detail"
      >
        <slot />
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
/*
 * Mobile holder for ClassDetail: a scrim sheet over the whole shell,
 * above MobileNav. Escape and the detail's own close button clear the
 * class stack, which unmounts this sheet; the scrim tap emits close so
 * the parent can do the same.
 */
const emit = defineEmits<{
  (e: "close"): void;
}>();
</script>

<style scoped>
.detail-scrim {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: var(--g-scrim);
  display: flex;
  align-items: flex-end;
}
.detail-sheet {
  width: 100%;
  height: calc(100dvh - 48px);
  display: flex;
  flex-direction: column;
  background: var(--g-surface);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-3);
  overflow: hidden;
  animation: sheet-up var(--motion-standard) var(--ease-out);
}
@keyframes sheet-up {
  from {
    transform: translateY(24px);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .detail-sheet {
    animation: none;
  }
}
</style>
