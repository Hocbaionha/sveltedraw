<script lang="ts" module>
  // $state-backed module bindings — see plugins/builtin/SidePanelChrome
  // header for the rationale. Plugin install() sets bindings.value;
  // any subsequent reassignment (uninstall → reinstall, HMR) flows
  // through the reactive proxy so the component re-renders.

  import type { ExamplePluginState } from "./state.svelte.js";

  type Bindings = {
    state: ExamplePluginState;
    onPing: () => void;
    onClearScene: () => void;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindPalettePanel(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import PluginPalette from "./PluginPalette.svelte";

  const safeBindings = $derived(bindings.value);
</script>

{#if safeBindings}
  <PluginPalette
    open={safeBindings.state.open}
    title="Example plugin"
    elementsCount={safeBindings.state.elementsCount}
    onClose={() => (safeBindings.state.open = false)}
    onPing={safeBindings.onPing}
    onClearScene={safeBindings.onClearScene}
  />
{/if}
