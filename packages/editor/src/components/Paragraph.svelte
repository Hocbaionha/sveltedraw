<script lang="ts">

  import type { Snippet } from 'svelte';

  // NOTE: `style` is a string (not a CSSProperties object).
  let {
    children,
    style = '',
  }: {
    children?: Snippet;
    style?: string;
  } = $props();
</script>

<p class="sveltedraw__paragraph" style={style}>
  {@render children?.()}
</p>
