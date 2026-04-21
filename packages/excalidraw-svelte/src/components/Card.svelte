<script lang="ts">
  // Port of packages/excalidraw/components/Card.tsx
  // SCSS (Card.scss) not imported — relies on global .Card styles from Excalidraw stylesheet

  import type { Snippet } from 'svelte';

  const COLOR_MAP = {
    primary: {
      base: 'var(--color-primary)',
      darker: 'var(--color-primary-darker)',
      darkest: 'var(--color-primary-darkest)',
    },
    lime: {
      base: '#74b816',
      darker: '#66a80f',
      darkest: '#5c940d',
    },
    pink: {
      base: '#d6336c',
      darker: '#c2255c',
      darkest: '#a61e4d',
    },
  } as const;

  let {
    children,
    color,
  }: {
    children?: Snippet;
    color: 'primary' | 'lime' | 'pink';
  } = $props();
</script>

<div
  class="Card"
  style:--card-color={COLOR_MAP[color].base}
  style:--card-color-darker={COLOR_MAP[color].darker}
  style:--card-color-darkest={COLOR_MAP[color].darkest}
>
  {@render children?.()}
</div>
