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
        originalLink={liveLink}
        onConfirm={safe.onConfirm}
        onClose={safe.onClose}
        enabled={safe.state.open}
      />
    </div>
  </div>
{/if}

<style>
  /* Overlay anchors the modal centred. dialog-layer slot already
     spans the editor; we add the visual chrome (backdrop + card). */
  .sveltedraw-link-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  }
  .sveltedraw-link-modal {
    background: var(--island-bg-color, #fff);
    border: 1px solid var(--border-color-medium, #d1d4da);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.16);
    padding: 16px;
    min-width: 320px;
    max-width: 480px;
  }
</style>
