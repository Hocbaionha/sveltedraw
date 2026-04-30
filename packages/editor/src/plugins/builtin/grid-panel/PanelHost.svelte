<script lang="ts" module>
  import type { GridPanelState } from "./state.svelte.js";
  import type { GridBridge } from "./bridge.js";

  type Bindings = {
    state: GridPanelState;
    bridge: GridBridge | null;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindPanelHost(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import GridPanel from "../../../components/GridPanel.svelte";
  import SidePanelChrome from "../SidePanelChrome.svelte";

  const safe = $derived(bindings.value);
</script>

<SidePanelChrome
  open={!!(safe?.state.open && safe.bridge)}
  id="builtin/grid-panel"
>
  {#if safe?.bridge}
    <GridPanel
      gridConfig={safe.bridge.gridConfig}
      snapConfig={safe.bridge.snapConfig}
      onGridConfigChange={(next) => safe.bridge?.setGridConfig(next)}
      onSnapConfigChange={(next) => safe.bridge?.setSnapConfig(next)}
    />
  {/if}
</SidePanelChrome>
