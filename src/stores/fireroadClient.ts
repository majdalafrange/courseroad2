/**
 * Singleton FireRoad client wired to the app's env and auth token.
 * Token is held here (not imported from the auth store) to avoid a
 * circular dependency between stores and the client.
 */

import { FireRoadClient } from "../lib/fireroad";

let currentToken: string | undefined;

export function setFireroadToken(token: string | undefined): void {
  currentToken = token;
}

export const fireroad = new FireRoadClient(
  import.meta.env.VITE_FIREROAD_URL,
  () => currentToken,
);
