<script lang="ts" module>
  // Module-level binding so the chrome-slot mount can read plugin state
  // without a bridge context. The plugin's install() captures the
  // collab store + click handler and calls bindTriggerHost once.
  //
  // Same pattern as PanelHost across the other built-in plugins.

  import type { CollabStore } from "../../../collab/store.svelte.js";

  type Bindings = {
    collabStore: CollabStore;
    /** Returns appState.width — read on every render so the trigger
     *  can re-evaluate icon-only vs label rendering on viewport resize. */
    getWidth: () => number;
    onClick: () => void;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindTriggerHost(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import LiveCollaborationTrigger from "../../../components/LiveCollaborationTrigger.svelte";

  const safe = $derived(bindings.value);
</script>

{#if safe}
  <!-- The trigger anchors itself top-right. The chrome slot wrapper is
       a positioned ancestor; absolute-positioning here escapes the
       slot's flex layout into the editor container's coordinate space.
       Status pill renders inline-left of the button when in a
       transient connection state. -->
  <div class="sveltedraw-collab-trigger">
    <LiveCollaborationTrigger
      isCollaborating={safe.collabStore.status === "connected"}
      onSelect={safe.onClick}
      width={safe.getWidth()}
      collaboratorCount={safe.collabStore.users.size}
    />
    {#if safe.collabStore.status === "connecting"}
      <div class="sveltedraw-collab-status sveltedraw-collab-status--connecting">
        <span class="sveltedraw-collab-status__dot"></span>
        Connecting…
      </div>
    {:else if safe.collabStore.status === "disconnected"}
      <div class="sveltedraw-collab-status sveltedraw-collab-status--disconnected">
        <span class="sveltedraw-collab-status__dot"></span>
        Disconnected
      </div>
    {/if}
  </div>
{/if}

<style>
  .sveltedraw-collab-trigger {
    position: absolute;
    top: 56px;
    right: 20px;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    /* Pill follows the button to its left so the row reads:
       [ status pill ] [ button ]. */
    flex-direction: row-reverse;
    pointer-events: auto;
  }

  .sveltedraw-collab-status {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.6rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 500;
    background: var(--island-bg-color, #fff);
    border: 1px solid var(--border-color-medium, #d1d4da);
    color: var(--text-primary-color, #1b1b1f);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    white-space: nowrap;
    user-select: none;
  }

  .sveltedraw-collab-status__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .sveltedraw-collab-status--connecting .sveltedraw-collab-status__dot {
    background: #f59f00;
    animation: sveltedraw-collab-pulse 1.2s ease-in-out infinite;
  }

  .sveltedraw-collab-status--disconnected .sveltedraw-collab-status__dot {
    background: #e03131;
  }

  @keyframes sveltedraw-collab-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }
</style>
