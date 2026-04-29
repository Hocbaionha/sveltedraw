<script lang="ts">
  // Port of the RowStack component from packages/engine/components/Stack.tsx
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
      align ? `align-items: ${align}` : '',
      justifyContent ? `justify-content: ${justifyContent}` : '',
      style,
    ]
      .filter(Boolean)
      .join('; '),
  );
</script>

<div bind:this={ref} class={clsx('Stack Stack_horizontal', className)} style={computedStyle}>
  {@render children?.()}
</div>

<style>
  /*
   * Inlined from packages/engine/components/Stack.scss
   */
  :global(.Stack) {
    --gap: 0;
    display: grid;
    gap: calc(var(--space-factor, 1px) * var(--gap));
  }

  :global(.Stack_horizontal) {
    grid-template-rows: auto;
    grid-auto-flow: column;
    grid-auto-columns: min-content;
  }
</style>
