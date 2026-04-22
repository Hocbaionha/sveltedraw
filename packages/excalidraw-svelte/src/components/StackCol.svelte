<script lang="ts">
  // Port of the ColStack component from packages/excalidraw/components/Stack.tsx
  // Outer DOM element exposed via a bindable `ref` prop.
  // SCSS (Stack.scss) not imported — styles inlined below.

  import type { Snippet } from 'svelte';
  import clsx from 'clsx';

  let {
    children,
    gap,
    align,
    justifyContent,
    class: className = '',
    style = '',
    ref = $bindable(),
  }: {
    children?: Snippet;
    gap?: number;
    align?: 'start' | 'center' | 'end' | 'baseline';
    justifyContent?: 'center' | 'space-around' | 'space-between';
    class?: string | boolean;
    style?: string;
    ref?: HTMLDivElement;
  } = $props();

  const computedStyle = $derived(
    [
      gap !== undefined ? `--gap: ${gap}` : '',
      align ? `justify-items: ${align}` : '',
      justifyContent ? `justify-content: ${justifyContent}` : '',
      style,
    ]
      .filter(Boolean)
      .join('; '),
  );
</script>

<div bind:this={ref} class={clsx('Stack Stack_vertical', className)} style={computedStyle}>
  {@render children?.()}
</div>

<style>
  /*
   * Inlined from packages/excalidraw/components/Stack.scss
   */
  :global(.Stack_vertical) {
    grid-template-columns: auto;
    grid-auto-flow: row;
    grid-auto-rows: min-content;
  }
</style>
