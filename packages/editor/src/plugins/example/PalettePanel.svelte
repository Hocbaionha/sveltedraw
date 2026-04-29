<script lang="ts" module>
  // Module-level singleton holding the plugin's bound props. Set by the
  // plugin's install() before the registry mounts this component so that
  // the parameterless mount path the registry uses can still reach the
  // plugin-local state + ctx callbacks.
  //
  // This pattern keeps the SveltedrawPluginContext.addSidePanel() contract
  // simple (Component reference, no props) while letting plugins close
  // over their own state without requiring authors to write a .svelte
  // wrapper.

  import type { ExamplePluginState } from "./state.svelte.js";

  type Bindings = {
    state: ExamplePluginState;
    onPing: () => void;
    onClearScene: () => void;
  };

  let bindings: Bindings | null = null;

  export function bindPalettePanel(b: Bindings): void {
    bindings = b;
  }
</script>

<script lang="ts">
  import PluginPalette from "./PluginPalette.svelte";

  // Reactive read into bindings — bind is set synchronously before the
  // plugin registers the panel, so it's never null at render time. The
  // typecheck guard is defensive only.
  const safeBindings = $derived(bindings);
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
