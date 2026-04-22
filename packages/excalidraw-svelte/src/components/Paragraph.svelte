<script lang="ts">
  // Port of packages/excalidraw/components/Paragraph.tsx

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

<p class="excalidraw__paragraph" style={style}>
  {@render children?.()}
</p>
