<script lang="ts" module>
  import type { AutoLayoutPanelState } from "./state.svelte.js";
  import type { AutoLayoutBridge } from "./bridge.js";

  type Bindings = {
    state: AutoLayoutPanelState;
    bridge: AutoLayoutBridge | null;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindPanelHost(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import AutoLayoutPanel from "../../../components/AutoLayoutPanel.svelte";
  import SidePanelChrome from "../SidePanelChrome.svelte";

  const safe = $derived(bindings.value);
</script>

<SidePanelChrome
  open={!!(safe?.state.open && safe.bridge)}
  id="builtin/autolayout-panel"
>
  {#if safe?.bridge}
    <AutoLayoutPanel
      selectedCount={safe.bridge.selectedCount}
      onLayout={(opts) => safe.bridge?.applyLayout(opts)}
    />
  {/if}
</SidePanelChrome>
