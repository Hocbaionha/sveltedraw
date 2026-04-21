<script lang="ts">
  // Port of packages/excalidraw/components/Tooltip.tsx
  // Uses bits-ui Tooltip (Root/Provider/Trigger/Content) instead of the imperative
  // DOM-mutation approach from the original. Preserves the same public API surface.

  import type { Snippet } from 'svelte';
  import { Tooltip } from 'bits-ui';

  let {
    children,
    label,
    long = false,
    style,
    disabled = false,
  }: {
    children?: Snippet;
    label: string;
    long?: boolean;
    style?: string;
    disabled?: boolean;
  } = $props();
</script>

{#if !disabled}
  <Tooltip.Provider delayDuration={0}>
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <div class="excalidraw-tooltip-wrapper" {style} {...props}>
            {@render children?.()}
          </div>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content>
        {#snippet child({ props })}
          <div
            {...props}
            class="excalidraw-tooltip excalidraw-tooltip--visible"
            style:min-width={long ? '50ch' : '10ch'}
            style:max-width={long ? '50ch' : '15ch'}
          >
            {label}
          </div>
        {/snippet}
      </Tooltip.Content>
    </Tooltip.Root>
  </Tooltip.Provider>
{/if}
