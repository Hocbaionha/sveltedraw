<script lang="ts">
  // Port of packages/excalidraw/components/FontPicker/FontPicker.tsx
  //
  // Contract:
  //  - `isOpened` / `onPopupChange` exposed directly (no internal open state).
  //  - `defaultFonts` (3-way hand-drawn / normal / code) kept as a prop
  //    (overrideable). Caller passes icons as snippets.
  //  - The full list (scene + available) passed as `sceneFonts`/`availableFonts`
  //    — caller assembles from Fonts.registered.

  import type { Snippet } from "svelte";
  import clsx from "clsx";
  import { Popover as BitsPopover } from "bits-ui";
  import ButtonSeparator from "../ButtonSeparator.svelte";
  import RadioSelection from "../RadioSelection.svelte";
  import FontPickerTrigger from "./FontPickerTrigger.svelte";
  import FontPickerList from "./FontPickerList.svelte";
  import type { FontDescriptor } from "./types.js";

  let {
    isOpened,
    selectedFontFamily,
    hoveredFontFamily,
    defaultFonts,
    sceneFonts,
    availableFonts,
    onSelect,
    onHover,
    onLeave,
    onPopupChange,
    compactMode = false,
    container,
  }: {
    isOpened: boolean;
    selectedFontFamily: number | null;
    hoveredFontFamily: number | null;
    /** 3-way quick-pick bar at the top of the picker. */
    defaultFonts: FontDescriptor[];
    sceneFonts: FontDescriptor[];
    availableFonts: FontDescriptor[];
    onSelect: (fontFamily: number) => void;
    onHover: (fontFamily: number) => void;
    onLeave: () => void;
    onPopupChange: (open: boolean) => void;
    compactMode?: boolean;
    container: HTMLElement | null;
  } = $props();

  function handleDefaultSelect(value: number) {
    if (value) onSelect(value);
  }
</script>

<div
  role="dialog"
  aria-modal="true"
  class={clsx("FontPicker__container", {
    "FontPicker__container--compact": compactMode,
  })}
>
  {#if !compactMode}
    <div class="buttonList">
      <RadioSelection
        type="button"
        options={defaultFonts.map((f) => ({
          value: f.value,
          text: f.text,
          icon: f.icon,
          testId: f.testId,
        }))}
        value={selectedFontFamily}
        onClick={(v) => handleDefaultSelect(v as number)}
      />
    </div>
    <ButtonSeparator />
  {/if}
  <BitsPopover.Root
    bind:open={() => isOpened, (v) => onPopupChange(v)}
  >
    <FontPickerTrigger
      {isOpened}
      {compactMode}
      onToggle={() => onPopupChange(!isOpened)}
    />
    {#if isOpened}
      <FontPickerList
        {selectedFontFamily}
        {hoveredFontFamily}
        {sceneFonts}
        {availableFonts}
        {onSelect}
        {onHover}
        {onLeave}
        onOpen={() => onPopupChange(true)}
        onClose={() => onPopupChange(false)}
        {container}
      />
    {/if}
  </BitsPopover.Root>
</div>
