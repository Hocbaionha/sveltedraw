<script lang="ts">
  //
  // Simplifications for the Svelte port:
  //  - `app.fonts.getSceneFamilies()` + `Fonts.registered` iteration hoisted
  //    out. Caller supplies pre-assembled `sceneFonts` + `availableFonts`.
  //  - Text-editor caret preservation (editingTextElement / sveltedraw-wysiwyg
  //    focus) NOT ported — Phase 6 wrapper can wrap `onSelect` with that logic.
  //  - QuickSearch debounce handled inline (setTimeout) since lodash.debounce
  //    isn't in @sveltedraw/editor deps.
  //  - Keyboard navigation (fontPickerKeyHandler) ported into this file's
  //    handleKeyDown — Enter selects hovered, Esc closes, arrows move hover.

  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { getContext } from "svelte";
  // @ts-ignore
  import { KEYS } from "@sveltedraw/common";
  import PropertiesPopover from "../PropertiesPopover.svelte";
  import QuickSearch from "../QuickSearch.svelte";
  import ScrollableList from "../ScrollableList.svelte";
  import DropdownMenuGroup from "../DropdownMenuGroup.svelte";
  import DropdownMenuItemContent from "../DropdownMenuItemContent.svelte";
  import type { FontDescriptor } from "./types.js";

  let {
    selectedFontFamily,
    hoveredFontFamily,
    sceneFonts,
    availableFonts,
    onSelect,
    onHover,
    onLeave,
    onOpen,
    onClose,
    container,
    showSearch = true,
    searchPlaceholder = "Search…",
    emptyPlaceholder = "No results",
    sceneFontsLabel = "In scene",
    availableFontsLabel = "Available",
  }: {
    selectedFontFamily: number | null;
    hoveredFontFamily: number | null;
    /** Fonts already used in the scene — rendered first. */
    sceneFonts: FontDescriptor[];
    /** Fonts not used in the scene. */
    availableFonts: FontDescriptor[];
    onSelect: (value: number) => void;
    onHover: (value: number) => void;
    onLeave: () => void;
    onOpen: () => void;
    onClose: () => void;
    container: HTMLElement | null;
    showSearch?: boolean;
    searchPlaceholder?: string;
    emptyPlaceholder?: string;
    sceneFontsLabel?: string;
    availableFontsLabel?: string;
  } = $props();

  let searchTerm = $state("");
  let searchDebounceId = 0;
  function setSearch(term: string) {
    clearTimeout(searchDebounceId);
    searchDebounceId = window.setTimeout(() => {
      searchTerm = term;
    }, 20);
  }

  const sceneFiltered = $derived(
    sceneFonts.filter((f) =>
      f.text.toLowerCase().includes(searchTerm.toLowerCase()),
    ),
  );
  const availableFiltered = $derived(
    availableFonts.filter((f) =>
      f.text.toLowerCase().includes(searchTerm.toLowerCase()),
    ),
  );
  const allFiltered = $derived([...sceneFiltered, ...availableFiltered]);

  const hoveredFont = $derived.by(() => {
    let font: FontDescriptor | undefined;
    if (hoveredFontFamily) {
      font = allFiltered.find((f) => f.value === hoveredFontFamily);
    } else if (selectedFontFamily) {
      font = allFiltered.find((f) => f.value === selectedFontFamily);
    }
    if (!font && searchTerm) {
      if (allFiltered[0]?.value) onHover(allFiltered[0].value);
      else onLeave();
    }
    return font ?? null;
  });

  let inputRef: HTMLInputElement | null = $state(null);

  onMount(() => {
    onOpen();
    return () => onClose();
  });

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === KEYS.ESCAPE) {
      onClose();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === KEYS.ENTER) {
      if (hoveredFont) {
        onSelect(hoveredFont.value);
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!allFiltered.length) return;
      const idx = hoveredFont
        ? allFiltered.findIndex((f) => f.value === hoveredFont.value)
        : -1;
      const nextIdx =
        event.key === "ArrowDown"
          ? (idx + 1) % allFiltered.length
          : (idx - 1 + allFiltered.length) % allFiltered.length;
      onHover(allFiltered[nextIdx].value);
      event.preventDefault();
      event.stopPropagation();
    }
  }
</script>

{#snippet fontItem(font: FontDescriptor, isFirst: boolean)}
  {@const isHovered = font.value === hoveredFont?.value}
  {@const isSelected = font.value === selectedFontFamily}
  <button
    type="button"
    value={font.value}
    class={`dropdown-menu-item dropdown-menu-item-base ${
      isSelected ? "dropdown-menu-item--selected" : ""
    } ${isHovered ? "dropdown-menu-item--hovered" : ""}`.trim()}
    title={font.text}
    tabindex={isSelected ? 0 : -1}
    onclick={() => onSelect(font.value)}
    onmousemove={() => {
      if (hoveredFont?.value !== font.value) onHover(font.value);
    }}
  >
    <DropdownMenuItemContent
      icon={font.icon}
      textStyle={`font-family: ${font.text};`}
    >
      {#snippet children()}{font.text}{/snippet}
    </DropdownMenuItemContent>
  </button>
{/snippet}

<PropertiesPopover
  class="properties-content"
  {container}
  style="width: 15rem;"
  onClose={onClose}
  onpointerleave={onLeave}
  onkeydown={handleKeyDown}
>
  {#if showSearch}
    <QuickSearch
      bind:ref={inputRef}
      placeholder={searchPlaceholder}
      onChange={setSearch}
    />
  {/if}
  <ScrollableList
    class="dropdown-menu fonts manual-hover"
    placeholder={emptyPlaceholder}
    isEmpty={!sceneFiltered.length && !availableFiltered.length}
  >
    {#if sceneFiltered.length}
      <DropdownMenuGroup title={sceneFontsLabel}>
        {#snippet children()}
          {#each sceneFiltered as font, i (font.value)}
            {@render fontItem(font, i === 0)}
          {/each}
        {/snippet}
      </DropdownMenuGroup>
    {/if}
    {#if availableFiltered.length}
      <DropdownMenuGroup title={availableFontsLabel}>
        {#snippet children()}
          {#each availableFiltered as font, i (font.value)}
            {@render fontItem(font, i === 0 && sceneFiltered.length === 0)}
          {/each}
        {/snippet}
      </DropdownMenuGroup>
    {/if}
  </ScrollableList>
</PropertiesPopover>
