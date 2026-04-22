<script lang="ts">
  // Port of packages/excalidraw/components/dropdownMenu/DropdownMenuItemCheckbox.tsx
  // emptyIcon was a placeholder <div>; we use a fixed-size empty span here.
  import type { Snippet } from "svelte";
  import DropdownMenuItem from "./DropdownMenuItem.svelte";
  import Icon from "../icons/Icon.svelte";

  let {
    checked,
    children,
    ...rest
  }: {
    checked: boolean;
    children: Snippet;
    [key: string]: unknown;
  } = $props();
</script>

<DropdownMenuItem {...rest}>
  {#snippet icon()}
    {#if checked}
      <Icon name="checkIcon" />
    {:else}
      <span style="width: 1rem; height: 1rem; display: inline-block;"></span>
    {/if}
  {/snippet}
  {@render children()}
</DropdownMenuItem>
