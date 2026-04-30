<script lang="ts" module>
  import type { AlignmentPanelState } from "./state.svelte.js";
  import type { AlignmentBridge } from "./bridge.js";

  type Bindings = {
    state: AlignmentPanelState;
    bridge: AlignmentBridge | null;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindPanelHost(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import AlignmentPanel from "../../../components/AlignmentPanel.svelte";
  import SidePanelChrome from "../SidePanelChrome.svelte";

  const safe = $derived(bindings.value);
</script>

<SidePanelChrome
  open={!!(safe?.state.open && safe.bridge)}
  id="builtin/alignment-panel"
>
  {#if safe?.bridge}
    <AlignmentPanel
      selectedCount={safe.bridge.selectedCount}
      onAlign={(t) => safe.bridge?.align(t)}
      onDistribute={(t) => safe.bridge?.distribute(t)}
    />
  {/if}
</SidePanelChrome>
