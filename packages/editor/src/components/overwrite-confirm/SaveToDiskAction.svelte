<script lang="ts">
  // Port of the `SaveToDisk` default action from
  // OverwriteConfirm/OverwriteConfirmActions.tsx.
  // Hoists the ActionManager dispatch to an `onClick` callback.

  import type { Snippet } from "svelte";
  import OverwriteConfirmAction from "./OverwriteConfirmAction.svelte";

  let {
    onClick,
    title = "Save to disk",
    actionLabel = "Save",
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
      Save the scene as a .sveltedraw file.
    {/if}
  {/snippet}
</OverwriteConfirmAction>
