<script lang="ts" module>
  // Module-level bindings hold the plugin's reactive state + bridge so
  // the parameterless component the registry mounts can still close
  // over them. Backing the slot with $state means bindPanelHost can be
  // called BEFORE component mount (current pattern) AND AFTER (future
  // hot-reload, plugin reinstall) without leaving the component reading
  // a stale value.

  import type { HistoryPanelState } from "./state.svelte.js";
  import type { HistoryUIBridge } from "./bridge.js";

  type Bindings = {
    state: HistoryPanelState;
    bridge: HistoryUIBridge | null;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindPanelHost(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import HistoryPanel from "../../../components/HistoryPanel.svelte";
  import type { HistoryState } from "../../../history/types.js";
  import SidePanelChrome from "../SidePanelChrome.svelte";

  const safe = $derived(bindings.value);
</script>

<SidePanelChrome
  open={!!(safe?.state.open && safe.bridge)}
  id="builtin/history-panel"
>
  {#if safe?.bridge}
    <HistoryPanel
      history={safe.bridge.history as HistoryState[]}
      currentIndex={safe.bridge.currentIndex}
      onJumpToState={(i) => safe.bridge?.jumpTo(i)}
      onClearHistory={() => safe.bridge?.clearKeepCurrent()}
    />
  {/if}
</SidePanelChrome>
