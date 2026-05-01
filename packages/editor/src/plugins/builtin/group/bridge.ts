// Host-published bridge for the group/ungroup plugin.
//
// The grouping helpers need:
//   1. The raw Scene (mutateElement on the current selection — the
//      SveltedrawAPI surface doesn't expose mutateElement directly).
//   2. pushHistory + bumpSceneRepaint — same pattern as Wave B.1's
//      z-order bridge.
//   3. randomId — to mint a fresh groupId on group(). The ID source
//      is host-owned so test/seed scenarios can swap a deterministic
//      generator without forking the plugin.
//
// App.svelte publishes a `{ getScene, pushHistory, bumpSceneRepaint,
// randomId }` object under GROUP_BRIDGE_KEY via registerCtx during
// the host's synchronous script body, before the plugins-install
// $effect fires.

export const GROUP_BRIDGE_KEY: unique symbol = Symbol("groupBridge");

export type GroupBridge = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getScene: () => any | null;
  pushHistory: () => void;
  bumpSceneRepaint: () => void;
  randomId: () => string;
};
