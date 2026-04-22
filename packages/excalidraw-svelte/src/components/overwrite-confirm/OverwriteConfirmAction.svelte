<script lang="ts">
  // Port of OverwriteConfirmActions.tsx Action component.
  // `ExportToImage` and `SaveToDisk` shortcuts from the upstream module
  // live in sibling files and accept plain onClick callbacks (the caller
  // wires them to its action system).

  import type { Snippet } from "svelte";
  import FilledButton from "../FilledButton.svelte";

  let {
    title,
    children,
    actionLabel,
    onClick,
  }: {
    title: string;
    children: Snippet;
    actionLabel: string;
    onClick: () => void;
  } = $props();
</script>

<div class="OverwriteConfirm__Actions__Action">
  <h4>{title}</h4>
  <div class="OverwriteConfirm__Actions__Action__content">
    {@render children()}
  </div>
  <FilledButton
    variant="outlined"
    color="muted"
    label={actionLabel}
    size="large"
    fullWidth
    onclick={onClick}
  />
</div>
