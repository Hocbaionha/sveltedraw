<script lang="ts">
  // Port of packages/excalidraw/components/Paragraph.tsx

  import type { Snippet } from 'svelte';

  // NOTE: React Paragraph accepted style?: React.CSSProperties (object).
  // Svelte uses style as a string — callers migrating from React must convert.
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
