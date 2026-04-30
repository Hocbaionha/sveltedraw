<script lang="ts" module>
  import type { MeasurementPanelState } from "./state.svelte.js";
  import type { MeasurementBridge } from "./bridge.js";

  type Bindings = {
    state: MeasurementPanelState;
    bridge: MeasurementBridge | null;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindPanelHost(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import MeasurementPanel from "../../../components/MeasurementPanel.svelte";
  import SidePanelChrome from "../SidePanelChrome.svelte";

  const safe = $derived(bindings.value);
</script>

<SidePanelChrome
  open={!!(safe?.state.open && safe.bridge)}
  id="builtin/measurement-panel"
>
  {#if safe?.bridge}
    <MeasurementPanel
      selectedElements={safe.bridge.selectedElements as Array<{ id: string; x: number; y: number; width: number; height: number }>}
      config={safe.bridge.config}
      onConfigChange={(next) => safe.bridge?.setConfig(next)}
    />
  {/if}
</SidePanelChrome>
