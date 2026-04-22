<script lang="ts">
  // Port of packages/excalidraw/components/HelpDialog.tsx — wrapper only.
  // SCSS sidecar (HelpDialog.scss) loaded globally by host app.
  //
  // Exposes composable building blocks (HelpDialogHeader, HelpDialogSection,
  // HelpDialogShortcutIsland, HelpDialogShortcut, HelpDialogShortcutKey); the
  // caller assembles the shortcut tables from its own action map.

  import type { Snippet } from "svelte";
  import Dialog from "../Dialog.svelte";

  let {
    onClose,
    children,
    title = "Help",
  }: {
    onClose?: () => void;
    children: Snippet;
    title?: string;
  } = $props();
</script>

<Dialog
  onCloseRequest={() => onClose?.()}
  {title}
  class="HelpDialog"
>
  {@render children()}
</Dialog>
