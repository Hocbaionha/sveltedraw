<script lang="ts">
  // Port of packages/excalidraw/components/InlineIcon.tsx
  // React: icon: React.ReactNode → Svelte: icon?: Snippet (rendered with {@render icon?.()})

  import type { Snippet } from 'svelte';

  let {
    class: className,
    icon,
    size = '1em',
  }: {
    class?: string;
    icon?: Snippet;
    size?: string;
  } = $props();
</script>

<span
  class={className}
  style:width={size}
  style:height="100%"
  style:margin="0 0.5ex 0 0.5ex"
  style:display="inline-flex"
  style:line-height="0"
  style:vertical-align="middle"
  style:flex="0 0 auto"
>
  {@render icon?.()}
</span>
