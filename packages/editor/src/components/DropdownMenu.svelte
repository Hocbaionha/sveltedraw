<script lang="ts">
  // Uses the bits-ui DropdownMenu primitive.
  //
  // Subcomponents are imported individually rather than dot-accessed:
  //   import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, ... }
  //
  // `open` is controlled by the parent.

  import type { Snippet } from 'svelte';
  // @ts-ignore
  import { CLASSES } from '@sveltedraw/common';
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
