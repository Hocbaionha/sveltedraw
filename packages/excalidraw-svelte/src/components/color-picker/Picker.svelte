<script lang="ts">
  // Port of packages/excalidraw/components/ColorPicker/Picker.tsx
  //
  // Contract:
  //  - `customColors` captured once per open-session.
  //  - `activeColorPickerSection` is read from `colorPickerSectionStore`.
  //  - Keyboard handler routed through the ported `colorPickerKeyNavHandler`.
  //  - i18n title + "mostUsedCustomColors"/"colors"/"shades" headings as props.

  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  // @ts-ignore upstream
  import {
    DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX,
    DEFAULT_ELEMENT_STROKE_COLOR_INDEX,
    EVENT,
    KEYS,
  } from "@sveltedraw/common";
  import type { ColorPaletteCustom } from "@sveltedraw/common";
  import type { ExcalidrawElement } from "@sveltedraw/element/types";
  import {
    colorPickerSectionStore,
    type ActiveColorPickerSection,
  } from "../../state/colorPickerState.svelte.js";
  import {
    getColorNameAndShadeFromColor,
    getMostUsedCustomColors,
    isCustomColor,
    type ColorPickerType,
  } from "./colorPickerUtils.js";
  import { colorPickerKeyNavHandler } from "./keyboardNavHandlers.js";
  import PickerHeading from "./PickerHeading.svelte";
  import PickerColorList from "./PickerColorList.svelte";
  import ShadeList from "./ShadeList.svelte";
  import CustomColorList from "./CustomColorList.svelte";

  let {
    color,
    onChange,
    type,
    elements,
    palette,
    children,
    showTitle = false,
    showHotKey = true,
    onEyeDropperToggle,
    onEscape,
    updateData,
    strokeLabel = "Stroke",
    backgroundLabel = "Background",
    colorPickerLabel = "Color picker",
    mostUsedLabel = "Most used",
    colorsLabel = "Colors",
    shadesLabel = "Shades",
    colorLabels = {},
  }: {
    color: string | null;
    onChange: (color: string) => void;
    type: ColorPickerType;
    elements: readonly ExcalidrawElement[];
    palette: ColorPaletteCustom;
    children?: Snippet;
    showTitle?: boolean;
    showHotKey?: boolean;
    onEyeDropperToggle: (force?: boolean) => void;
    onEscape: (event: KeyboardEvent) => void;
    updateData?: (formData?: unknown) => void;
    strokeLabel?: string;
    backgroundLabel?: string;
    colorPickerLabel?: string;
    mostUsedLabel?: string;
    colorsLabel?: string;
    shadesLabel?: string;
    colorLabels?: Record<string, string>;
  } = $props();

  const title = $derived(
    showTitle
      ? type === "elementStroke"
        ? strokeLabel
        : type === "elementBackground"
          ? backgroundLabel
          : null
      : null,
  );

  // Captured once on first render (no re-init on prop change).
  // svelte-ignore state_referenced_locally
  const customColors: string[] =
    type === "canvasBackground"
      ? []
      : getMostUsedCustomColors(elements, type, palette);

  const colorObj = $derived(getColorNameAndShadeFromColor({ color, palette }));

  // Auto-pick initial active section when none set yet.
  $effect(() => {
    if (colorPickerSectionStore.section) return;
    const isCustom = !!color && isCustomColor({ color, palette });
    const isCustomButNotInList = isCustom && !customColors.includes(color!);
    colorPickerSectionStore.set(
      isCustomButNotInList
        ? null
        : isCustom
          ? "custom"
          : colorObj?.shade != null
            ? "shades"
            : "baseColors",
    );
  });

  // svelte-ignore state_referenced_locally
  let activeShade = $state(
    colorObj?.shade ??
      (type === "elementBackground"
        ? DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX
        : DEFAULT_ELEMENT_STROKE_COLOR_INDEX),
  );

  $effect(() => {
    if (colorObj?.shade != null) activeShade = colorObj.shade;
  });

  // Alt keyup releases the eye-dropper.
  $effect(() => {
    const keyup = (event: KeyboardEvent) => {
      if (event.key === KEYS.ALT) onEyeDropperToggle(false);
    };
    document.addEventListener(EVENT.KEYUP, keyup, { capture: true });
    return () =>
      document.removeEventListener(EVENT.KEYUP, keyup, { capture: true });
  });

  let pickerEl: HTMLDivElement | null = $state(null);
  onMount(() => {
    pickerEl?.focus();
  });

  function handleKeyDown(event: KeyboardEvent) {
    const handled = colorPickerKeyNavHandler({
      event,
      activeColorPickerSection: colorPickerSectionStore.section,
      palette,
      color,
      onChange,
      onEyeDropperToggle,
      customColors,
      setActiveColorPickerSection: (s: ActiveColorPickerSection) =>
        colorPickerSectionStore.set(s),
      updateData,
      activeShade,
      onEscape,
    });
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
</script>

<div role="dialog" aria-modal="true" aria-label={colorPickerLabel}>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={pickerEl}
    onkeydown={handleKeyDown}
    class="color-picker-content properties-content"
    tabindex="-1"
  >
    {#if title}
      <div class="color-picker__title">{title}</div>
    {/if}

    {#if customColors.length}
      <div>
        <PickerHeading>
          {#snippet children()}{mostUsedLabel}{/snippet}
        </PickerHeading>
        <CustomColorList
          colors={customColors}
          {color}
          label={mostUsedLabel}
          {onChange}
        />
      </div>
    {/if}

    <div>
      <PickerHeading>
        {#snippet children()}{colorsLabel}{/snippet}
      </PickerHeading>
      <PickerColorList
        {color}
        {palette}
        {onChange}
        {activeShade}
        {showHotKey}
        {colorLabels}
      />
    </div>

    <div>
      <PickerHeading>
        {#snippet children()}{shadesLabel}{/snippet}
      </PickerHeading>
      <ShadeList {color} {onChange} {palette} {showHotKey} />
    </div>

    {@render children?.()}
  </div>
</div>
