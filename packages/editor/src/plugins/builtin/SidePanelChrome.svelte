<script lang="ts">
  // Shared shell for built-in side panels. Eliminates the ~16-line
  // CSS block that was duplicated across history/alignment/measurement/
  // autolayout PanelHost.svelte files. Plugin authors mounting a side
  // panel now just import this component and pass their content as
  // the default snippet.
  //
  // Visual layout matches the prior inline App.svelte side-panel
  // styles (right-docked column anchored under the utility bar).
  //
  // The wrapper renders nothing when `open === false` so plugins can
  // still control visibility through their own state.

  import type { Snippet } from "svelte";

  let {
    open,
    children,
    /** Optional override id for testing / debugging — surfaces as
        `data-panel-id` on the wrapper. Plugins normally won't set this. */
    id,
  }: {
    open: boolean;
    children: Snippet;
    id?: string;
  } = $props();
</script>

{#if open}
  <div class="sveltedraw-builtin-side-panel" data-panel-id={id}>
    {@render children()}
  </div>
{/if}

<style>
  .sveltedraw-builtin-side-panel {
    position: absolute;
    top: 110px;
    right: 16px;
    width: var(--right-sidebar-width, 302px);
    max-height: calc(100vh - 130px);
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    z-index: 40;
    overflow: hidden;
  }
  :global(.sveltedraw.theme--dark) .sveltedraw-builtin-side-panel {
    background: #232329;
    border-color: #363636;
  }
</style>
