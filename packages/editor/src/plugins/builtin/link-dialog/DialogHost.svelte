<script lang="ts" module>
  // Module-level binding so the dialog-layer chrome slot can reach
  // the plugin's state + bridge without a Svelte context dance.

  import type { LinkDialogState } from "./state.svelte.js";
  import type { LinkDialogBridge } from "./bridge.js";

  type Bindings = {
    state: LinkDialogState;
    bridge: LinkDialogBridge;
    onClose: () => void;
    onConfirm: (nextLink: string | null) => void;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindDialogHost(b: Bindings): void {
    bindings.value = b;
  }

  /** Cleared on plugin teardown so a stale instance from a torn-down
   *  registry can't keep the dialog open or hold references to a
   *  vanished bridge. */
  export function unbindDialogHost(): void {
    bindings.value = null;
  }
</script>

<script lang="ts">
  import ElementLinkDialog from "../../../components/ElementLinkDialog.svelte";

  const safe = $derived(bindings.value);

  // Resolve the live link reactively. We read bridge.getLink each
  // time the state.targetId or open flips; the bridge's getLink
  // touches the host's sceneReady nonce internally so this re-runs
  // when mutateElement changes the field.
  const liveLink = $derived.by(() => {
    if (!safe?.state.open || !safe.state.targetId) return null;
    return safe.bridge.getLink(safe.state.targetId);
  });
</script>

{#if safe?.state.open && safe.state.targetId && safe.bridge.isAlive(safe.state.targetId)}
  <!-- Modal overlay. Click on backdrop closes; Esc inside the dialog
       too. stopPropagation prevents inner clicks from reaching the
       backdrop and triggering close-on-click. -->
  <div
    class="sveltedraw-link-overlay"
    role="presentation"
    onclick={safe.onClose}
  >
    <div
      class="sveltedraw-link-modal"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => { if (e.key === "Escape") safe.onClose(); }}
    >
      <ElementLinkDialog
        link={liveLink}
        originalLink={safe.state.originalLink}
        onConfirm={safe.onConfirm}
        onClose={safe.onClose}
        enabled={safe.state.open}
      />
    </div>
  </div>
{/if}

<style>
  /* Restored from the inline App.svelte modal — must use `position:
     fixed` + a real z-index, otherwise the overlay is clipped by the
     editor's transformed parent and renders behind the toolbar. */
  .sveltedraw-link-overlay {
    position: fixed;
    inset: 0;
    background: rgba(12, 13, 19, 0.55);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sveltedraw-link-modal {
    background: #fff;
    border-radius: 8px;
    padding: 16px 18px;
    width: min(480px, 92vw);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
  }
  :global(.sveltedraw.theme--dark) .sveltedraw-link-modal {
    background: #1a1a1e;
    color: #e5e7ea;
  }
</style>
