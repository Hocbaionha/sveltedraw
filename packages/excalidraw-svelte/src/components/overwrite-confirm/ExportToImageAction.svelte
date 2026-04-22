<script lang="ts">
  // Port of the `ExportToImage` default action from
  // OverwriteConfirm/OverwriteConfirmActions.tsx.
  //
  // The caller's `onClick` is expected to do both:
  // `actionChangeExportEmbedScene` and
  // `setAppState({ openDialog: "imageExport" })`.

  import type { Snippet } from "svelte";
  import OverwriteConfirmAction from "./OverwriteConfirmAction.svelte";

  let {
    onClick,
    title = "Export to image",
    actionLabel = "Export",
    description,
  }: {
    onClick: () => void;
    title?: string;
    actionLabel?: string;
    description?: Snippet;
  } = $props();
</script>

<OverwriteConfirmAction {title} {actionLabel} {onClick}>
  {#snippet children()}
    {#if description}
      {@render description()}
    {:else}
      Save the scene as an image file.
    {/if}
  {/snippet}
</OverwriteConfirmAction>
