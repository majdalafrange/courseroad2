<template>
  <div class="prereq-group" :class="groupClasses">
    <span v-if="label && !leafOnly" class="group-label">{{ label }}</span>
    <div class="group-items">
      <span v-if="label && leafOnly" class="group-label">{{ label }}</span>
      <template v-for="(child, index) in children" :key="index">
        <prereq-tree
          v-if="isGroup(child)"
          :node="child"
          :root="false"
          :depth="depth + 1"
        />
        <button
          v-else
          class="prereq-chip"
          :class="{ known: isKnown(child) }"
          :title="child.title || undefined"
          @click="openLeaf(child)"
          @pointerdown="dragLeaf($event, child)"
        >
          <g-icon
            v-if="child.fulfilled"
            name="check"
            :size="10"
            class="chip-check"
          />
          <span class="chip-id">{{ child.subject_id }}</span>
          <span v-if="child.fulfilled" class="sr-only">satisfied</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import GIcon from "../../design/components/GIcon.vue";
import {
  isGroup,
  type ParsedLeaf,
  type ParsedRequirement,
} from "../../lib/prereqTree";
import { getSubject } from "../../lib/types";
import { useCourseDataStore } from "../../stores/courseData";
import { pointerDown } from "../../stores/dragdrop";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    node: ParsedRequirement;
    root?: boolean;
    depth?: number;
  }>(),
  { root: true, depth: 0 },
);

const store = useCourseDataStore();

/** Collapse single-child chains: the child renders in the parent's place. */
function resolve(
  node: ParsedRequirement | ParsedLeaf,
): ParsedRequirement | ParsedLeaf {
  let current = node;
  while (isGroup(current) && current.reqs.length === 1) {
    current = current.reqs[0];
  }
  return current;
}

const effective = computed(() => resolve(props.node));

const children = computed<(ParsedRequirement | ParsedLeaf)[]>(() => {
  const node = effective.value;
  if (!isGroup(node)) {
    return [node];
  }
  return node.reqs.map(resolve);
});

const leafOnly = computed(() =>
  children.value.every((child) => !isGroup(child)),
);

/* The count appears only when every child is a chip; with a nested group
   present it would contradict the visible id count. */
const label = computed(() => {
  const node = effective.value;
  if (!isGroup(node) || children.value.length < 2) {
    return "";
  }
  if (node.connectionType === "any") {
    return leafOnly.value ? `Any 1 of ${children.value.length}:` : "Any one of";
  }
  if (node.connectionType === "all") {
    return leafOnly.value ? `All ${children.value.length}:` : "All of";
  }
  return "";
});

const groupClasses = computed(() => ({
  "is-root": props.root && isGroup(effective.value),
  "is-nested": !props.root,
  "depth-1": !props.root && props.depth === 1,
}));

function isKnown(child: ParsedLeaf): boolean {
  return getSubject(store.catalog, stripGir(child.subject_id)) !== undefined;
}

function stripGir(id: string): string {
  return id.indexOf("GIR:") === 0 ? id.substring(4) : id;
}

function openLeaf(leaf: ParsedLeaf) {
  const id = stripGir(leaf.subject_id);
  if (getSubject(store.catalog, id) !== undefined) {
    store.pushClassStack(id);
  }
}

function dragLeaf(event: PointerEvent, leaf: ParsedLeaf) {
  const subject = getSubject(store.catalog, stripGir(leaf.subject_id));
  if (subject !== undefined) {
    store.dragStartClass({ classInfo: subject });
    pointerDown(event, { subject, isNew: true });
  }
}
</script>

<script lang="ts">
export default { name: "PrereqTree" };
</script>

<style scoped>
/* The root group is a box with no rule of its own. Nested groups indent
   off a single rule, stepped two levels: strong at depth 1, hairline
   deeper, so a deep tree reads as structure rather than boxes in boxes. */
.prereq-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-width: 100%;
}
.prereq-group.is-root {
  border: 1px solid var(--g-line);
  border-radius: var(--radius-sm);
  padding: var(--space-2);
}
.prereq-group.is-nested {
  border-left: 2px solid var(--g-line);
  padding: var(--space-1) 0 var(--space-1) var(--space-3);
}
.prereq-group.is-nested.depth-1 {
  border-left-color: var(--g-line-strong);
}

.group-label {
  font: var(--text-small);
  font-weight: 600;
  color: var(--g-ink-2);
}

.group-items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
}
/* A nested group always starts its own row; leaf-only rows wrap freely. */
.group-items > .prereq-group {
  flex-basis: 100%;
}

/* the shared course-chip anatomy (see tokens.css); unknown ids stay a
   sunken neutral. A satisfied chip stays neutral too: the check icon is
   the single mark, per the one-encoding rule. */
.prereq-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font: var(--text-id-small);
  color: var(--g-ink-2);
  height: 22px;
  background: var(--g-surface-sunken);
  border: none;
  border-left: 3px solid var(--g-line-strong);
  border-radius: var(--radius-sm);
  padding: 0 var(--space-2);
  cursor: default;
  white-space: nowrap;
  transition: background-color var(--motion-quick) var(--ease-out);
}
.prereq-chip.known {
  cursor: pointer;
  color: var(--g-ink);
  background: var(--g-surface);
  box-shadow: inset 0 0 0 1px var(--g-line);
}
.prereq-chip.known:hover {
  background: var(--g-accent-tint);
}
.chip-check {
  flex-shrink: 0;
  color: var(--g-ok);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
