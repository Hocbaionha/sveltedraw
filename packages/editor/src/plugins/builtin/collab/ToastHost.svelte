<script lang="ts" module>
  import type { CollabPluginState } from "./state.svelte.js";

  type Bindings = {
    state: CollabPluginState;
    onClose: () => void;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindToastHost(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import Toast from "../../../components/Toast.svelte";

  const safe = $derived(bindings.value);
</script>

{#if safe?.state.toast}
  <div
    class="sveltedraw-collab-toast"
    class:sveltedraw-collab-toast--warn={safe.state.toast.tone === "warn"}
    class:sveltedraw-collab-toast--ok={safe.state.toast.tone === "ok"}
  >
    <Toast
      message={safe.state.toast.message}
      onClose={safe.onClose}
      closable
    />
  </div>
{/if}

<style>
  /* Tone-driven left border so the toast carries severity at a glance.
     Container styling otherwise inherits from the bottom-center
     toast-layer chrome slot. */
  .sveltedraw-collab-toast {
    pointer-events: auto;
  }
  .sveltedraw-collab-toast--warn :global(.Toast) {
    border-left: 4px solid #e8590c;
  }
  .sveltedraw-collab-toast--ok :global(.Toast) {
    border-left: 4px solid #2f9e44;
  }
</style>
