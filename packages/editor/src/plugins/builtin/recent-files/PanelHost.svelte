<script lang="ts" module>
  // Module-level bindings backed by $state so reassignment after the
  // component first mounts (uninstall + reinstall, HMR, etc.) is
  // tracked reactively. Plugin install() sets `bindings.value` before
  // addSidePanel registers this component, so the first mount sees a
  // non-null value too.

  import type { RecentFilesState } from "./state.svelte.js";

  type Bindings = {
    state: RecentFilesState;
    onDelete: (id: string) => void;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindPanelHost(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import RecentFilesPanel from "../../../components/RecentFilesPanel.svelte";

  const safe = $derived(bindings.value);
</script>

{#if safe?.state.open}
  <RecentFilesPanel
    files={safe.state.files}
    onClose={() => (safe.state.open = false)}
    onDelete={safe.onDelete}
  />
{/if}
