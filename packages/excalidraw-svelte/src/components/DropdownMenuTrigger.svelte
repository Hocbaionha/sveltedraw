<script lang="ts">
  // Port of packages/excalidraw/components/dropdownMenu/DropdownMenuTrigger.tsx
  // formFactor passed as a prop.

  import type { Snippet } from 'svelte';
  import { DropdownMenu as BitsDropdownMenu } from 'bits-ui';
  import clsx from 'clsx';

  let {
    children,
    onToggle,
    title,
    className = '',
    formFactor = 'desktop',
    ...rest
  }: {
    children?: Snippet;
    onToggle: () => void;
    title?: string;
    className?: string;
    formFactor?: 'desktop' | 'phone' | 'tablet';
    [key: string]: unknown;
  } = $props();

  const classes = $derived(
    clsx(`dropdown-menu-button ${className}`, 'zen-mode-transition', {
      'dropdown-menu-button--mobile': formFactor === 'phone',
    }).trim(),
  );
</script>

<BitsDropdownMenu.Trigger>
  {#snippet child({ props })}
    <button
      {...props}
      type="button"
      class={classes}
      onclick={onToggle}
      data-testid="dropdown-menu-button"
      {title}
      {...rest}
    >
      {@render children?.()}
    </button>
  {/snippet}
</BitsDropdownMenu.Trigger>
