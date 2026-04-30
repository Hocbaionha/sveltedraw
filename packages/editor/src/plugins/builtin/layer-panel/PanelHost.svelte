<script lang="ts" module>
  import type { LayerPanelState } from "./state.svelte.js";
  import type { LayerBridge } from "./bridge.js";

  type Bindings = {
    state: LayerPanelState;
    bridge: LayerBridge | null;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindPanelHost(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import LayerPanel from "../../../components/LayerPanel.svelte";
  import type { LayerItem } from "../../../layers/types.js";
  import SidePanelChrome from "../SidePanelChrome.svelte";

  const safe = $derived(bindings.value);
</script>

<SidePanelChrome
  open={!!(safe?.state.open && safe.bridge)}
  id="builtin/layer-panel"
>
  {#if safe?.bridge}
    <LayerPanel
      layers={safe.bridge.layers as LayerItem[]}
      selectedLayerId={safe.bridge.selectedLayerId}
      onLayerSelect={(id) => safe.bridge?.onLayerSelect(id)}
      onLayerVisibilityChange={(id, v) => safe.bridge?.onLayerVisibilityChange(id, v)}
      onLayerLockChange={(id, v) => safe.bridge?.onLayerLockChange(id, v)}
      onLayerOpacityChange={(id, v) => safe.bridge?.onLayerOpacityChange(id, v)}
      onCreateGroup={() => safe.bridge?.onCreateGroup()}
      onDeleteGroup={(id) => safe.bridge?.onDeleteGroup(id)}
      onReorderLayers={(from, to) => safe.bridge?.onReorderLayers(from, to)}
    />
  {/if}
</SidePanelChrome>
