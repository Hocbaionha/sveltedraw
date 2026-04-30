<script lang="ts" module>
  import type { AppSettings, SettingsState } from "./state.svelte.js";

  type Bindings = {
    state: SettingsState;
    onChange: (next: AppSettings) => void;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindPanelHost(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import SettingsPanel from "../../../components/SettingsPanel.svelte";

  const safe = $derived(bindings.value);
</script>

{#if safe?.state.open}
  <SettingsPanel
    settings={safe.state.values}
    onSettingsChange={safe.onChange}
    onClose={() => (safe.state.open = false)}
  />
{/if}
