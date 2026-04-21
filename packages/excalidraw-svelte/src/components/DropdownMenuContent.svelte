<script lang="ts">
  // Port of packages/excalidraw/components/dropdownMenu/DropdownMenuContent.tsx
  // - useOutsideClick handled by bits-ui (interactOutsideBehavior).
  // - ESC handled by bits-ui (escapeKeydownBehavior).
  // - Mobile branch (Stack.Col instead of Island) accepted as a prop.

  import type { Snippet } from 'svelte';
  import { DropdownMenu as BitsDropdownMenu } from 'bits-ui';
  import Island from './Island.svelte';
  import StackCol from './StackCol.svelte';
  import clsx from 'clsx';

  let {
    children,
    onClickOutside,
    className = '',
    align = 'end',
    style,
    formFactor = 'desktop',
  }: {
    children?: Snippet;
    onClickOutside?: () => void;
    className?: string;
    align?: 'start' | 'center' | 'end';
    style?: string;
    formFactor?: 'desktop' | 'phone' | 'tablet';
  } = $props();

  const classes = $derived(
    clsx(`dropdown-menu ${className}`, {
      'dropdown-menu--mobile': formFactor === 'phone',
    }).trim(),
  );

  function handleInteractOutside(_event: PointerEvent) {
    onClickOutside?.();
  }

  function handleEscape() {
    onClickOutside?.();
  }
</script>

<BitsDropdownMenu.Content
  {align}
  sideOffset={8}
  onInteractOutside={handleInteractOutside}
  onEscapeKeydown={handleEscape}
  onCloseAutoFocus={(event) => event.preventDefault()}
>
  {#snippet child({ props })}
    <div {...props} class={classes} {style} data-testid="dropdown-menu">
      {#if formFactor === 'phone'}
        <StackCol class="dropdown-menu-container">
          {@render children?.()}
        </StackCol>
      {:else}
        <Island class="dropdown-menu-container" padding={2}>
          {@render children?.()}
        </Island>
      {/if}
    </div>
  {/snippet}
</BitsDropdownMenu.Content>
