<script lang="ts" module>
  import type { HistoryPanelState } from "./state.svelte.js";
  import type { HistoryUIBridge } from "./bridge.js";

  type Bindings = {
    state: HistoryPanelState;
    bridge: HistoryUIBridge | null;
  };

  let bindings: Bindings | null = null;

  export function bindPanelHost(b: Bindings): void {
    bindings = b;
  }
</script>

<script lang="ts">
  import HistoryPanel from "../../../components/HistoryPanel.svelte";
  import type { HistoryState } from "../../../history/types.js";

  const safe = $derived(bindings);
</script>

{#if safe?.state.open && safe.bridge}
  <div class="sveltedraw-history-panel">
    <HistoryPanel
      history={safe.bridge.history as HistoryState[]}
      currentIndex={safe.bridge.currentIndex}
      onJumpToState={(i) => safe.bridge?.jumpTo(i)}
      onClearHistory={() => safe.bridge?.clearKeepCurrent()}
    />
  </div>
{/if}

<style>
  /* Mirrors the inline App.svelte rule that previously framed this
     panel. Layout matches the other side panels (right-docked column,
     under the utility bar). */
  .sveltedraw-history-panel {
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
  :global(.sveltedraw.theme--dark) .sveltedraw-history-panel {
    background: #232329;
    border-color: #363636;
  }
</style>
