/** Cross-surface bus for opening the command palette pre-scoped (the audit's gap-to-action). */

import { ref } from "vue";

export interface PaletteRequest {
  query?: string;
  tokens?: string[];
}

export const paletteRequest = ref<PaletteRequest | null>(null);

export function requestPalette(request: PaletteRequest): void {
  paletteRequest.value = request;
}
