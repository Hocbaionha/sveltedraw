<script lang="ts" module>
  import type { AlignmentPanelState } from "./state.svelte.js";
  import type { AlignmentBridge } from "./bridge.js";

  type Bindings = {
    state: AlignmentPanelState;
    bridge: AlignmentBridge | null;
  };

  let bindings: Bindings | null = null;

  export function bindPanelHost(b: Bindings): void {
    bindings = b;
  }
</script>

<script lang="ts">
  import AlignmentPanel from "../../../components/AlignmentPanel.svelte";

  const safe = $derived(bindings);
</script>

{#if safe?.state.open && safe.bridge}
  <div class="sveltedraw-alignment-panel">
    <AlignmentPanel
      selectedCount={safe.bridge.selectedCount}
      onAlign={(t) => safe.bridge?.align(t)}
      onDistribute={(t) => safe.bridge?.distribute(t)}
    />
  </div>
{/if}

<style>
  .sveltedraw-alignment-panel {
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
  :global(.sveltedraw.theme--dark) .sveltedraw-alignment-panel {
    background: #232329;
    border-color: #363636;
  }
</style>
