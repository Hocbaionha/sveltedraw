<script lang="ts" module>
  import type { CollabPluginState } from "./state.svelte.js";
  import type { IdentityResult } from "../../../components/CollabIdentityDialog.svelte";

  type Bindings = {
    state: CollabPluginState;
    palette: readonly string[];
    onSubmit: (result: IdentityResult) => void;
    onCancel: () => void;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindDialogHost(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import CollabIdentityDialog from "../../../components/CollabIdentityDialog.svelte";

  const safe = $derived(bindings.value);
</script>

{#if safe?.state.dialogOpen}
  <CollabIdentityDialog
    palette={safe.palette}
    suggestedId={safe.state.pendingAnonId ?? ""}
    onSubmit={safe.onSubmit}
    onCancel={safe.onCancel}
  />
{/if}
