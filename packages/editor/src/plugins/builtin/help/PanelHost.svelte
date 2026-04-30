<script lang="ts" module>
  import type { HelpState } from "./state.svelte.js";

  let bindings: { state: HelpState } | null = null;

  export function bindPanelHost(b: { state: HelpState }): void {
    bindings = b;
  }
</script>

<script lang="ts">
  import HelpPanel from "../../../components/HelpPanel.svelte";

  const safe = $derived(bindings);
</script>

{#if safe?.state.open}
  <HelpPanel onClose={() => (safe.state.open = false)} />
{/if}
