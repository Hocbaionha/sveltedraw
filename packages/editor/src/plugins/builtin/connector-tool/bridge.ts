// Bridge for the connector tool plugin. createArrow stays in
// App.svelte because it needs scene mutation, pushHistory,
// bumpSceneRepaint, and the upstream newArrowElement helper.
// Selection highlighting (which shape the user has picked first) is
// also driven by App.svelte's appState.

export const CONNECTOR_BRIDGE_KEY: unique symbol = Symbol("connectorBridge");

export type ConnectorBridge = {
  /** Build the bound arrow connecting two elements. Mutates scene
   *  and pushes history. */
  createArrow(fromId: string, toId: string): void;
  /** Highlight one element as the "first pick" so the user can see
   *  which shape they're connecting from. Pass null to clear. */
  setHighlight(elementId: string | null): void;
  /** True if the element id refers to a live, non-deleted element of
   *  a type that supports binding (rectangle / ellipse / diamond /
   *  image / frame / text). Connector pickup logic uses this to skip
   *  freedraw / line / arrow / lone text without parent shape, where
   *  bound-arrow routing can't track meaningfully. */
  isBindableElement(elementId: string): boolean;
};
