<script lang="ts" module>
  import type { AutoLayoutPanelState } from "./state.svelte.js";
  import type { AutoLayoutBridge } from "./bridge.js";

  type Bindings = {
    state: AutoLayoutPanelState;
    bridge: AutoLayoutBridge | null;
  };

  let bindings: Bindings | null = null;

  export function bindPanelHost(b: Bindings): void {
    bindings = b;
  }
</script>

<script lang="ts">
  import AutoLayoutPanel from "../../../components/AutoLayoutPanel.svelte";

  const safe = $derived(bindings);
</script>

{#if safe?.state.open && safe.bridge}
  <div class="sveltedraw-autolayout-panel">
    <AutoLayoutPanel
      selectedCount={safe.bridge.selectedCount}
      onLayout={(opts) => safe.bridge?.applyLayout(opts)}
    />
  </div>
{/if}

<style>
  .sveltedraw-autolayout-panel {
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
  :global(.sveltedraw.theme--dark) .sveltedraw-autolayout-panel {
    background: #232329;
    border-color: #363636;
  }
</style>
