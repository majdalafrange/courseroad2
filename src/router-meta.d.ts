// A module (the export below), so this augments vue-router's types; in a
// global script file the same block would replace the whole module.
export {};

declare module "vue-router" {
  /** Set by each page in the (app) group via definePage; read by the shell. */
  interface RouteMeta {
    mode?: "plan" | "explore";
    /** id of the page's <main>, the skip link's target. */
    mainId?: string;
  }
}
