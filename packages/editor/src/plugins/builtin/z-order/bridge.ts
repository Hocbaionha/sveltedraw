// Host-published bridge for the z-order plugin.
//
// The reorder operations need three things from the host:
//   1. The raw Scene (replaceAllElements + getElementsIncludingDeleted —
//      the SveltedrawAPI surface is element-centric and doesn't expose
//      replaceAllElements or the soft-deleted entries that fractional-
//      index reordering needs to consider).
//   2. pushHistory — the host owns the undo stack; our reorder must
//      land an undo step before bumpSceneRepaint paints.
//   3. bumpSceneRepaint — the single chokepoint that triggers the
//      static-render repaint, fires onChange, and dispatches per-
//      element observers.
//
// App.svelte publishes a `{ getScene, pushHistory, bumpSceneRepaint }`
// object under Z_ORDER_BRIDGE_KEY via registerCtx during the host's
// synchronous script body, before the plugins-install $effect fires.

export const Z_ORDER_BRIDGE_KEY: unique symbol = Symbol("zOrderBridge");

export type ZOrderBridge = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getScene: () => any | null;
  pushHistory: () => void;
  bumpSceneRepaint: () => void;
};
