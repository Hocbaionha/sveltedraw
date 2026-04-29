<script lang="ts">
  import type { Snippet } from "svelte";
  let {
    children,
    label,
  }: {
    children?: Snippet;
    /** Plain-text key (alternative to children). */
    label?: string;
  } = $props();
</script>

<kbd class="HelpDialog__key">
  {#if children}{@render children()}{:else}{label}{/if}
</kbd>
