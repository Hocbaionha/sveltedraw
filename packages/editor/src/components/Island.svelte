<script lang="ts">
  // Outer DOM element exposed via a bindable `ref` prop.
  // SCSS (Island.scss) not imported — styles inlined below.

  import type { Snippet } from 'svelte';
  import clsx from 'clsx';

  let {
    children,
    padding,
    class: className = '',
    style = '',
    ref = $bindable(),
  }: {
    children?: Snippet;
    padding?: number;
    class?: string | boolean;
    style?: string;
    ref?: HTMLDivElement;
  } = $props();

  // Build merged style: CSS custom property + caller-supplied styles
  const computedStyle = $derived(
    [padding !== undefined ? `--padding: ${padding}` : '', style]
      .filter(Boolean)
      .join('; '),
  );
</script>

<div bind:this={ref} class={clsx('Island', className)} style={computedStyle}>
  {@render children?.()}
</div>

<style>
  /*
   * Inlined from packages/engine/components/Island.scss
   * (no build pipeline for SCSS imports in editor)
   */
  :global(.Island) {
    --padding: 0;
    box-sizing: border-box;
    background-color: var(--island-bg-color);
    box-shadow: var(--shadow-island);
    border-radius: var(--border-radius-lg);
    padding: calc(var(--padding) * var(--space-factor));
    position: relative;
    transition: box-shadow 0.5s ease-in-out;
  }

  :global(.Island.zen-mode) {
    box-shadow: none;
  }
</style>
