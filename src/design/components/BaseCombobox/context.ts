/**
 * Shared between BaseComboboxRoot's children: the result list's element id,
 * for the input's aria-controls.
 *
 * Reka UI passes that id to its input through a plain (non-reactive)
 * context field that is only filled in when the list mounts. The input
 * renders first, so its aria-controls stays empty until something else
 * re-renders it (the first keystroke): a combobox that controls nothing,
 * as far as assistive tech can tell, whenever it opens empty. The list
 * reports its real id here once mounted, and the input binds to it.
 */
import { inject, provide, ref, type InjectionKey, type Ref } from "vue";

const LIST_ID: InjectionKey<Ref<string | undefined>> =
  Symbol("BaseComboboxListId");

export function provideListId(): Ref<string | undefined> {
  const listId = ref<string | undefined>(undefined);
  provide(LIST_ID, listId);
  return listId;
}

export function injectListId(): Ref<string | undefined> {
  return inject(LIST_ID, ref(undefined));
}

/* Whether the root's list is open: Reka mounts the listbox inside
   BaseComboboxList only then, so the list re-reads its id on each change. */
const LIST_OPEN: InjectionKey<Readonly<Ref<boolean>>> = Symbol(
  "BaseComboboxListOpen",
);

export function provideListOpen(open: Readonly<Ref<boolean>>): void {
  provide(LIST_OPEN, open);
}

export function injectListOpen(): Readonly<Ref<boolean>> {
  return inject(LIST_OPEN, ref(true));
}
