<script lang="ts">
  // Port of packages/excalidraw/components/ActiveConfirmDialog.tsx
  //
  // Takes the current `active` value + `onConfirm`/`onCancel` callbacks as
  // props. The caller wires these to the store + action dispatch.

  import ConfirmDialog from "./ConfirmDialog.svelte";

  let {
    active,
    onConfirm,
    onCancel,
    title = "Clear canvas",
    message = "Clearing the canvas will permanently remove all elements. Are you sure?",
    confirmText = "Confirm",
    cancelText = "Cancel",
  }: {
    active: "clearCanvas" | null;
    onConfirm: () => void;
    onCancel: () => void;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
  } = $props();
</script>

{#if active === "clearCanvas"}
  <ConfirmDialog
    {onConfirm}
    {onCancel}
    {title}
    {confirmText}
    {cancelText}
  >
    <p class="clear-canvas__content">{message}</p>
  </ConfirmDialog>
{/if}
