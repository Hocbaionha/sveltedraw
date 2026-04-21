<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    children,
    className = '',
    style,
    title,
  }: {
    children: Snippet;
    className?: string;
    style?: string;
    title?: string;
  } = $props();
</script>

<div class={`dropdown-menu-group ${className}`} {style}>
  {#if title}
    <p class="dropdown-menu-group-title">{title}</p>
  {/if}
  {@render children()}
</div>
