<script lang="ts">
  // Port of packages/excalidraw/components/dropdownMenu/DropdownMenu.tsx
  // Uses bits-ui DropdownMenu primitive (radix-ui equivalent in React).
  //
  // The React version implements DropdownMenu.Trigger / .Content as static
  // properties on the function component. Svelte components don't support that,
  // so consumers import each subcomponent separately:
  //   import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, ... }
  //
  // open is controlled by the parent.

  import type { Snippet } from 'svelte';
  // @ts-ignore upstream package
  import { CLASSES } from '@excalidraw/common';
  import { DropdownMenu as BitsDropdownMenu } from 'bits-ui';

  let {
    children,
    open,
  }: {
    children?: Snippet;
    open: boolean;
  } = $props();
</script>

<BitsDropdownMenu.Root bind:open={() => open, () => {}}>
  <div
    class={CLASSES.DROPDOWN_MENU_EVENT_WRAPPER}
    style="display: contents;"
  >
    {@render children?.()}
  </div>
</BitsDropdownMenu.Root>
