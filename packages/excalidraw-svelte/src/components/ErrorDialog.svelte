<script lang="ts">
  // Port of packages/excalidraw/components/ErrorDialog.tsx
  // Container focus is performed by Dialog's `onBeforeClose` (Phase 6 wiring)
  // so this port stays presentational.

  import type { Snippet } from "svelte";
  import Dialog from "./Dialog.svelte";

  let {
    children,
    onClose,
    onBeforeClose,
    title = "Error",
  }: {
    children?: Snippet;
    onClose?: () => void;
    onBeforeClose?: () => void;
    title?: string;
  } = $props();

  let dismissed = $state(false);
  const visible = $derived(!!children && !dismissed);

  function handleClose() {
    dismissed = true;
    onClose?.();
  }
</script>

{#if visible}
  <Dialog
    size="small"
    onCloseRequest={handleClose}
    {onBeforeClose}
    {title}
  >
    <div style="white-space: pre-wrap;">
      {@render children?.()}
    </div>
  </Dialog>
{/if}
