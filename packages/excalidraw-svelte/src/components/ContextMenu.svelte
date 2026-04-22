<script lang="ts" module>
  // Port of packages/excalidraw/components/ContextMenu.tsx
  // SCSS sidecar (ContextMenu.scss) loaded globally by host app.
  //
  // Purely presentational: takes already-resolved items (caller handles
  // filtering / labelling / dispatch against its action system). Viewport
  // sizing (offsetLeft/offsetTop/width/height) is passed in as plain props.
  // Uses the ported legacy Popover (positioned div + focus trap).

  export const CONTEXT_MENU_SEPARATOR = "separator" as const;

  export type ContextMenuRenderedItem = {
    testId?: string;
    label: string;
    shortcut?: string;
    dangerous?: boolean;
    checked?: boolean;
    onSelect: () => void;
  };

  export type ContextMenuItem =
    | typeof CONTEXT_MENU_SEPARATOR
    | ContextMenuRenderedItem;
</script>

<script lang="ts">
  import Popover from "./Popover.svelte";

  let {
    items,
    top,
    left,
    onClose,
    offsetLeft = 0,
    offsetTop = 0,
    viewportWidth,
    viewportHeight,
  }: {
    items: ContextMenuItem[];
    top: number;
    left: number;
    /**
     * `callback` lets callers run logic AFTER the menu has closed (e.g.
     * actions that require the closed-state appState). */
    onClose: (callback?: () => void) => void;
    offsetLeft?: number;
    offsetTop?: number;
    viewportWidth?: number;
    viewportHeight?: number;
  } = $props();

  // Drop leading separators and collapse adjacent separators.
  const filteredItems = $derived(
    items.filter((item, idx) => {
      if (item !== CONTEXT_MENU_SEPARATOR) return true;
      const prev = items[idx - 1];
      return prev && prev !== CONTEXT_MENU_SEPARATOR;
    }),
  );
</script>

<Popover
  onCloseRequest={() => onClose()}
  {top}
  {left}
  fitInViewport={true}
  {offsetLeft}
  {offsetTop}
  {viewportWidth}
  {viewportHeight}
  class="context-menu-popover"
>
  <ul
    class="context-menu"
    oncontextmenu={(event) => event.preventDefault()}
  >
    {#each filteredItems as item, idx (idx)}
      {#if item === CONTEXT_MENU_SEPARATOR}
        <hr class="context-menu-item-separator" />
      {:else}
        <li data-testid={item.testId}>
          <button
            type="button"
            class="context-menu-item"
            class:dangerous={item.dangerous}
            class:checkmark={item.checked}
            onclick={() => onClose(() => item.onSelect())}
          >
            <div class="context-menu-item__label">{item.label}</div>
            <kbd class="context-menu-item__shortcut">{item.shortcut ?? ""}</kbd>
          </button>
        </li>
      {/if}
    {/each}
  </ul>
</Popover>
