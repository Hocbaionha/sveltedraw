<script lang="ts" module>
  import type { ConnectorState } from "./state.svelte.js";

  type Bindings = {
    state: ConnectorState;
    onCancel: () => void;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindPanelHost(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import ConnectorTool from "../../../components/ConnectorTool.svelte";

  const safe = $derived(bindings.value);
</script>

{#if safe?.state.active}
  <div class="sveltedraw-connector-panel" data-panel-id="builtin/connector-tool">
    <ConnectorTool
      hasFirstPick={safe.state.firstPickId !== null}
      onCancel={safe.onCancel}
    />
  </div>
{/if}

<style>
  /* Connector tool indicator. Bottom-right per the original layout in
     App.svelte; not a side panel — it floats over the canvas while the
     tool is active. */
  .sveltedraw-connector-panel {
    position: absolute;
    bottom: 16px;
    right: 20px;
    width: 280px;
    max-height: 50vh;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    z-index: 40;
    overflow: hidden;
  }
  :global(.sveltedraw.theme--dark) .sveltedraw-connector-panel {
    background: #232329;
    border-color: #363636;
  }
</style>
