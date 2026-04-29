<script lang="ts">

  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  type Props = {
    children?: Snippet;
    style?: string;
  } & Omit<HTMLAttributes<HTMLSpanElement>, 'style' | 'children'>;

  let { children, style = '', ...rest }: Props = $props();

  // Merge base ellipsis styles with any caller-supplied style string
  const baseStyle =
    'text-overflow: ellipsis; overflow: hidden; white-space: nowrap;';
  // $derived so it re-computes if `style` prop changes
  const mergedStyle = $derived(style ? `${baseStyle} ${style}` : baseStyle);
</script>

<span style={mergedStyle} {...rest}>
  {@render children?.()}
</span>
