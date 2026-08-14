/**
 * Tiny cross-surface bus for opening the command palette pre-scoped;
 * the audit's "gap to action" (an unfulfilled requirement one click away
 * from the classes that could satisfy it).
 */

import { ref } from "vue";

export interface PaletteRequest {
  query?: string;
  tokens?: string[];
}

export const paletteRequest = ref<PaletteRequest | null>(null);

export function requestPalette(request: PaletteRequest): void {
  paletteRequest.value = request;
}
