<script lang="ts" module>
  // Module-level binding so the plugin's state + bridge reach the
  // parameterless Component the registry mounts. Same pattern as the
  // other plugin PanelHosts.

  import type { LaserState } from "./state.svelte.js";
  import type { LaserBridge } from "./bridge.js";

  type Bindings = {
    state: LaserState;
    bridge: LaserBridge | null;
    fadeMs: number;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindOverlay(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import LaserOverlay from "../../../components/LaserOverlay.svelte";

  const safe = $derived(bindings.value);
</script>

{#if safe?.bridge}
  <LaserOverlay
    active={safe.state.active}
    trail={safe.state.trail}
    frame={safe.state.frame}
    fadeMs={safe.fadeMs}
    width={safe.bridge.width}
    height={safe.bridge.height}
  />
{/if}
