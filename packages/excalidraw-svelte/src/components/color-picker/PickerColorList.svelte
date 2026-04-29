<script lang="ts">
  import clsx from "clsx";
  // @ts-ignore upstream
  import type { ColorPaletteCustom } from "@sveltedraw/common";
  import HotkeyLabel from "./HotkeyLabel.svelte";
  import {
    colorPickerHotkeyBindings,
    getColorNameAndShadeFromColor,
  } from "./colorPickerUtils.js";
  import { colorPickerSectionStore } from "../../state/colorPickerState.svelte.js";

  let {
    palette,
    color,
    onChange,
    activeShade,
    showHotKey = true,
    colorLabels = {},
  }: {
    palette: ColorPaletteCustom;
    color: string | null;
    onChange: (color: string) => void;
    activeShade: number;
    showHotKey?: boolean;
    /** Map color-name → localized label (Phase 6 wires `t("colors.X")`).
     *  Keys without an entry render with the raw color-name. */
    colorLabels?: Record<string, string>;
  } = $props();

  const colorObj = $derived(getColorNameAndShadeFromColor({ color, palette }));

  // Buttons are registered into this array by key so we can focus the active
  // one whenever the section becomes "baseColors".
  const buttons = new Map<string, HTMLButtonElement>();
  $effect(() => {
    if (colorPickerSectionStore.section !== "baseColors") return;
    const name = colorObj?.colorName;
    if (name && buttons.get(name)) {
      buttons.get(name)!.focus();
    }
  });
</script>

<div class="color-picker-content--default">
  {#each Object.entries(palette) as [key, value], index (key)}
    {@const resolvedColor =
      (Array.isArray(value) ? value[activeShade] : value) || "transparent"}
    {@const keybinding = colorPickerHotkeyBindings[index]}
    {@const label = colorLabels[key.replace(/\d+/, "")] ?? key}
    <button
      bind:this={
        () => buttons.get(key),
        (el) => el && buttons.set(key, el)
      }
      tabindex="-1"
      type="button"
      class={clsx(
        "color-picker__button color-picker__button--large has-outline",
        {
          active: colorObj?.colorName === key,
          "is-transparent": resolvedColor === "transparent" || !resolvedColor,
        },
      )}
      onclick={() => {
        onChange(resolvedColor);
        colorPickerSectionStore.set("baseColors");
      }}
      title={`${label}${resolvedColor.startsWith("#") ? ` ${resolvedColor}` : ""} — ${keybinding}`}
      aria-label={`${label} — ${keybinding}`}
      style={resolvedColor ? `--swatch-color: ${resolvedColor};` : undefined}
      data-testid={`color-${key}`}
    >
      <div class="color-picker__button-outline"></div>
      {#if showHotKey}
        <HotkeyLabel color={resolvedColor} keyLabel={keybinding} />
      {/if}
    </button>
  {/each}
</div>
