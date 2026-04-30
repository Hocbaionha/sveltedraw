<script lang="ts" module>
  // Module-level binding so the parameterless component the registry
  // mounts can still reach the plugin-local state. Set inside install()
  // before addSidePanel registers this component.

  import type { RecentFilesState } from "./state.svelte.js";

  type Bindings = {
    state: RecentFilesState;
    onDelete: (id: string) => void;
  };

  let bindings: Bindings | null = null;

  export function bindPanelHost(b: Bindings): void {
    bindings = b;
  }
</script>

<script lang="ts">
  import RecentFilesPanel from "../../../components/RecentFilesPanel.svelte";

  // Reactive read of the module-level singleton. Defensive null check;
  // bindings are set synchronously inside install() before the
  // registry mounts this component.
  const safe = $derived(bindings);
</script>

{#if safe?.state.open}
  <RecentFilesPanel
    files={safe.state.files}
    onClose={() => (safe.state.open = false)}
    onDelete={safe.onDelete}
  />
{/if}
