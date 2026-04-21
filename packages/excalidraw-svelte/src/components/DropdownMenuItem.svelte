<script lang="ts">
  // Port of packages/excalidraw/components/dropdownMenu/DropdownMenuItem.tsx
  // Inlines DropdownMenuItemContent (small enough that splitting it adds noise).
  // formFactor passed as prop (React reads it from context).
  // The shared DropdownMenuContentPropsContext.onSelect from React is replaced
  // by an explicit `onParentSelect` prop — DropdownMenuContent forwards it
  // via prop drilling rather than Svelte context (kept simple for now).

  import type { Snippet } from 'svelte';
  import { DropdownMenu as BitsDropdownMenu } from 'bits-ui';
  import Ellipsify from './Ellipsify.svelte';

  let {
    icon,
    badge,
    value,
    children,
    shortcut,
    className,
    selected,
    onSelect,
    onParentSelect,
    formFactor = 'desktop',
    ...rest
  }: {
    icon?: Snippet;
    badge?: Snippet;
    value?: string | number;
    children: Snippet;
    shortcut?: string;
    className?: string;
    selected?: boolean;
    onSelect?: (event: Event) => void;
    onParentSelect?: (event: Event) => void;
    formFactor?: 'desktop' | 'phone' | 'tablet';
    [key: string]: unknown;
  } = $props();

  const buttonClass = $derived(
    `dropdown-menu-item dropdown-menu-item-base ${className ?? ''} ${
      selected ? 'dropdown-menu-item--selected' : ''
    }`.trim(),
  );

  function handleSelect(event: Event) {
    onSelect?.(event);
    if (!event.defaultPrevented) {
      onParentSelect?.(event);
    }
  }
</script>

<BitsDropdownMenu.Item onSelect={handleSelect}>
  {#snippet child({ props })}
    <button
      {...props}
      type="button"
      {value}
      class={buttonClass}
      title={(rest.title as string | undefined) ?? (rest['aria-label'] as string | undefined)}
      {...rest}
    >
      {#if icon}
        <div class="dropdown-menu-item__icon">{@render icon()}</div>
      {/if}
      <div class="dropdown-menu-item__text">
        <Ellipsify>
          {@render children()}
        </Ellipsify>
      </div>
      {#if badge}
        <div class="dropdown-menu-item__badge">{@render badge()}</div>
      {/if}
      {#if shortcut && formFactor !== 'phone'}
        <div class="dropdown-menu-item__shortcut">{shortcut}</div>
      {/if}
    </button>
  {/snippet}
</BitsDropdownMenu.Item>
