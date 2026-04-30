<script lang="ts" module>
  import type { MeasurementPanelState } from "./state.svelte.js";
  import type { MeasurementBridge } from "./bridge.js";

  type Bindings = {
    state: MeasurementPanelState;
    bridge: MeasurementBridge | null;
  };

  let bindings: Bindings | null = null;

  export function bindPanelHost(b: Bindings): void {
    bindings = b;
  }
</script>

<script lang="ts">
  import MeasurementPanel from "../../../components/MeasurementPanel.svelte";

  const safe = $derived(bindings);
</script>

{#if safe?.state.open && safe.bridge}
  <div class="sveltedraw-measurement-panel">
    <MeasurementPanel
      selectedElements={safe.bridge.selectedElements as Array<{ id: string; x: number; y: number; width: number; height: number }>}
      config={safe.bridge.config}
      onConfigChange={(next) => safe.bridge?.setConfig(next)}
    />
  </div>
{/if}

<style>
  .sveltedraw-measurement-panel {
    position: absolute;
    top: 110px;
    right: 16px;
    width: var(--right-sidebar-width, 302px);
    max-height: calc(100vh - 130px);
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    z-index: 40;
    overflow: hidden;
  }
  :global(.sveltedraw.theme--dark) .sveltedraw-measurement-panel {
    background: #232329;
    border-color: #363636;
  }
</style>
