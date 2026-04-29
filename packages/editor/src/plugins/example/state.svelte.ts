// Plugin-local reactive state. Sveltedraw 5 runes ($state) only run
// inside .svelte / .svelte.ts modules, so we put the state factory in
// a sibling file and import it from index.ts.

export type ExamplePluginState = {
  open: boolean;
  elementsCount: number;
};

export function createPluginState(): ExamplePluginState {
  // Plain $state on a single object — every property is auto-reactive
  // via the Svelte 5 proxy. Reads from the SidePanelShim register
  // dependencies on the property level so re-renders are minimal.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const state = $state<ExamplePluginState>({
    open: false,
    elementsCount: 0,
  });
  return state;
}
