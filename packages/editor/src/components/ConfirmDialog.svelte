<script lang="ts">
  // App-state side effects (e.g. closing menus) are hoisted to Dialog's
  // optional `onBeforeClose` callback — the caller supplies them.

  import type { Snippet } from "svelte";
  import Dialog, { type DialogSize } from "./Dialog.svelte";
  import DialogActionButton from "./DialogActionButton.svelte";

  let {
    onConfirm,
    onCancel,
    onBeforeClose,
    children,
    title,
    confirmText = "Confirm",
    cancelText = "Cancel",
    class: className = "",
    size = "small",
    closeLabel,
    autofocus,
    closeOnClickOutside,
  }: {
    onConfirm: () => void;
    onCancel: () => void;
    onBeforeClose?: () => void;
    children: Snippet;
    title: Snippet | string | false;
    confirmText?: string;
    cancelText?: string;
    class?: string;
    size?: DialogSize;
    closeLabel?: string;
    autofocus?: boolean;
    closeOnClickOutside?: boolean;
  } = $props();
</script>

<Dialog
  onCloseRequest={onCancel}
  {onBeforeClose}
  {size}
  class={`confirm-dialog ${className}`}
  {title}
  {closeLabel}
  {autofocus}
  {closeOnClickOutside}
>
  {@render children()}
  <div class="confirm-dialog-buttons">
    <DialogActionButton label={cancelText} onclick={onCancel} />
    <DialogActionButton
      label={confirmText}
      onclick={onConfirm}
      actionType="danger"
    />
  </div>
</Dialog>
