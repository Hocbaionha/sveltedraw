<script lang="ts" module>
  import type { HelpState } from "./state.svelte.js";

  type Bindings = { state: HelpState };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindPanelHost(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import HelpPanel from "../../../components/HelpPanel.svelte";

  const safe = $derived(bindings.value);
</script>

{#if safe?.state.open}
  <HelpPanel onClose={() => (safe.state.open = false)} />
{/if}
