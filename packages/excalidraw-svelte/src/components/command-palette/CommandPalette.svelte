<script lang="ts" module>
  // Port of packages/excalidraw/components/CommandPalette/CommandPalette.tsx
  // SCSS sidecar (CommandPalette.scss) loaded globally.
  //
  // Shell only: Dialog + search input + grouped result list + keyboard nav
  // (arrow keys to hover, Enter to select, Esc to close). Caller supplies
  // pre-filtered items (fuzzy search, ActionManager-dispatched defaults,
  // library items, shape switch, etc. all live in the caller) and handles
  // `onSelect`.

  import type { Snippet } from "svelte";

  export type CommandPaletteItem = {
    /** Stable identifier. */
    id: string;
    label: string;
    category: string;
    /** Optional icon snippet for the left-hand column. */
    icon?: Snippet;
    /** Display shortcut (e.g., "Cmd+K"). */
    shortcut?: string | null;
  };
</script>

<script lang="ts">
  import { onMount } from "svelte";
  // @ts-ignore upstream
  import { KEYS } from "@sveltedraw/common";
  import Dialog from "../Dialog.svelte";
  import TextField from "../TextField.svelte";
  import Ellipsify from "../Ellipsify.svelte";
  import Icon from "../../icons/Icon.svelte";

  let {
    open,
    onClose,
    items,
    onSelect,
    searchTerm = $bindable(""),
    searchPlaceholder = "Search…",
    emptyPlaceholder = "No matching commands",
    title = "Command palette",
  }: {
    open: boolean;
    onClose: () => void;
    /** Pre-filtered items ordered by group. Caller does the fuzzy/haystack
     * match + predicate + categorization. */
    items: CommandPaletteItem[];
    /** Called when an item is activated (click or Enter). */
    onSelect: (item: CommandPaletteItem) => void;
    /** Controlled search term (two-way bindable). */
    searchTerm?: string;
    searchPlaceholder?: string;
    emptyPlaceholder?: string;
    title?: string;
  } = $props();

  // Group items by category preserving insertion order.
  const groups = $derived.by(() => {
    const byCat = new Map<string, CommandPaletteItem[]>();
    for (const item of items) {
      const list = byCat.get(item.category);
      if (list) list.push(item);
      else byCat.set(item.category, [item]);
    }
    return Array.from(byCat.entries()).map(([category, list]) => ({
      category,
      items: list,
    }));
  });

  let hoveredIndex = $state(0);
  $effect(() => {
    // Reset hover when the filtered list changes (new search term).
    if (hoveredIndex >= items.length) hoveredIndex = 0;
  });

  let listEl: HTMLDivElement | null = $state(null);
  let searchInput: HTMLInputElement | undefined = $state();

  onMount(() => {
    searchInput?.focus();
  });

  function handleSearchKeyDown(event: KeyboardEvent) {
    if (event.key === KEYS.ESCAPE) {
      onClose();
      event.preventDefault();
      return;
    }
    if (event.key === KEYS.ENTER) {
      if (items[hoveredIndex]) {
        onSelect(items[hoveredIndex]);
        event.preventDefault();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      if (items.length)
        hoveredIndex = (hoveredIndex + 1) % items.length;
      event.preventDefault();
    } else if (event.key === "ArrowUp") {
      if (items.length)
        hoveredIndex = (hoveredIndex - 1 + items.length) % items.length;
      event.preventDefault();
    }
  }

  // Scroll hovered item into view.
  $effect(() => {
    const hoveredEl = listEl?.querySelector<HTMLElement>(
      `[data-hovered="true"]`,
    );
    hoveredEl?.scrollIntoView({ block: "nearest" });
  });

  // Compute the flat index for an item so hover state maps to groups.
  function flatIndex(group: number, localIndex: number): number {
    let idx = 0;
    for (let g = 0; g < group; g++) idx += groups[g].items.length;
    return idx + localIndex;
  }
</script>

{#if open}
  <Dialog onCloseRequest={onClose} {title} size="small" class="CommandPalette">
    <TextField
      bind:ref={searchInput}
      value={searchTerm}
      onChange={(v) => (searchTerm = v)}
      onKeyDown={handleSearchKeyDown}
      placeholder={searchPlaceholder}
    />
    <div class="CommandPalette__scroll" bind:this={listEl}>
      {#if items.length === 0}
        <div class="CommandPalette__empty">{emptyPlaceholder}</div>
      {:else}
        {#each groups as group, gIdx (group.category)}
          <div class="CommandPalette__category">
            <div class="CommandPalette__category__label">
              {group.category}
            </div>
            {#each group.items as item, iIdx (item.id)}
              {@const isHovered = flatIndex(gIdx, iIdx) === hoveredIndex}
              <button
                type="button"
                class="CommandPalette__item"
                class:hovered={isHovered}
                data-hovered={isHovered}
                onclick={() => onSelect(item)}
                onmousemove={() =>
                  (hoveredIndex = flatIndex(gIdx, iIdx))}
              >
                {#if item.icon}
                  <div class="CommandPalette__item__icon">
                    {@render item.icon()}
                  </div>
                {/if}
                <div class="CommandPalette__item__label">
                  <Ellipsify>{item.label}</Ellipsify>
                </div>
                {#if item.shortcut}
                  <div class="CommandPalette__item__shortcut">
                    {item.shortcut}
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        {/each}
      {/if}
    </div>
  </Dialog>
{/if}
