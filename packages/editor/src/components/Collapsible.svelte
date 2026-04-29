<script lang="ts">
  // Open state is controlled (kept outside) so the user's previous choice
  // survives unmount/remount cycles.

  import type { Snippet } from "svelte";
  import InlineIcon from "./InlineIcon.svelte";
  import Icon from "../icons/Icon.svelte";

  let {
    label,
    open,
    openTrigger,
    children,
    class: className = "",
    showCollapsedIcon = true,
  }: {
    label: Snippet | string;
    open: boolean;
    openTrigger: () => void;
    children: Snippet;
    class?: string;
    showCollapsedIcon?: boolean;
  } = $props();
</script>

<div
  style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;"
  class={className}
  onclick={openTrigger}
  role="button"
  tabindex="0"
  onkeydown={(e) => e.key === "Enter" && openTrigger()}
>
  {#if typeof label === "string"}
    {label}
  {:else}
    {@render label()}
  {/if}
  {#if showCollapsedIcon}
    {#snippet collapseIcon()}
      <Icon name={open ? "collapseUpIcon" : "collapseDownIcon"} />
    {/snippet}
    <InlineIcon icon={collapseIcon} />
  {/if}
</div>
{#if open}
  <div style="display: flex; flex-direction: column;">
    {@render children()}
  </div>
{/if}
