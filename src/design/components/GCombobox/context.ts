/**
 * Shared between GComboboxRoot's children: the result list's element id,
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
  Symbol("GComboboxListId");

export function provideListId(): Ref<string | undefined> {
  const listId = ref<string | undefined>(undefined);
  provide(LIST_ID, listId);
  return listId;
}

export function injectListId(): Ref<string | undefined> {
  return inject(LIST_ID, ref(undefined));
}
