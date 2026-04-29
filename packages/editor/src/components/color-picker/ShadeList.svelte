<script lang="ts">
  import clsx from "clsx";
  // @ts-ignore
  import type { ColorPaletteCustom } from "@sveltedraw/common";
  import HotkeyLabel from "./HotkeyLabel.svelte";
  import { getColorNameAndShadeFromColor } from "./colorPickerUtils.js";
  import { colorPickerSectionStore } from "../../state/colorPickerState.svelte.js";

  let {
    color,
    onChange,
    palette,
    showHotKey = false,
    noShadesLabel = "No shades",
  }: {
    color: string | null;
    onChange: (color: string) => void;
    palette: ColorPaletteCustom;
    showHotKey?: boolean;
    noShadesLabel?: string;
  } = $props();

  const colorObj = $derived(
    getColorNameAndShadeFromColor({ color: color || "transparent", palette }),
  );

  const buttons: HTMLButtonElement[] = [];
  $effect(() => {
    if (colorPickerSectionStore.section !== "shades") return;
    const idx = colorObj?.shade;
    if (idx != null && buttons[idx]) buttons[idx].focus();
  });
</script>

{#if colorObj && Array.isArray(palette[colorObj.colorName])}
  {@const shades = palette[colorObj.colorName] as readonly string[]}
  <div class="color-picker-content--default shades">
    {#each shades as shadeColor, i (i)}
      <button
        bind:this={() => buttons[i], (el) => el && (buttons[i] = el)}
        tabindex="-1"
        type="button"
        class={clsx(
          "color-picker__button color-picker__button--large has-outline",
          { active: i === colorObj.shade },
        )}
        aria-label="Shade"
        title={`${colorObj.colorName} - ${i + 1}`}
        style={shadeColor ? `--swatch-color: ${shadeColor};` : undefined}
        onclick={() => {
          onChange(shadeColor);
          colorPickerSectionStore.set("shades");
        }}
      >
        <div class="color-picker__button-outline"></div>
        {#if showHotKey}
          <HotkeyLabel color={shadeColor} keyLabel={i + 1} isShade />
        {/if}
      </button>
    {/each}
  </div>
{:else}
  <div
    class="color-picker-content--default"
    style="position: relative;"
    tabindex="-1"
  >
    <button
      type="button"
      tabindex="-1"
      class="color-picker__button color-picker__button--large color-picker__button--no-focus-visible"
      aria-label={noShadesLabel}
    ></button>
    <div
      tabindex="-1"
      style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 0.75rem;"
    >
      {noShadesLabel}
    </div>
  </div>
{/if}
