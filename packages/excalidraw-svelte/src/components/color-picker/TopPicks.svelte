<script lang="ts">
  import clsx from "clsx";
  // @ts-ignore upstream package
  import {
    COLOR_OUTLINE_CONTRAST_THRESHOLD,
    DEFAULT_CANVAS_BACKGROUND_PICKS,
    DEFAULT_ELEMENT_BACKGROUND_PICKS,
    DEFAULT_ELEMENT_STROKE_PICKS,
    isColorDark,
  } from "@sveltedraw/common";
  import type { ColorPickerType } from "./colorPickerUtils.js";

  let {
    onChange,
    type,
    activeColor,
    topPicks,
  }: {
    onChange: (color: string) => void;
    type: ColorPickerType;
    activeColor: string | null;
    topPicks?: readonly string[];
  } = $props();

  const colors = $derived.by(() => {
    if (topPicks) return topPicks;
    if (type === "elementStroke") return DEFAULT_ELEMENT_STROKE_PICKS;
    if (type === "elementBackground") return DEFAULT_ELEMENT_BACKGROUND_PICKS;
    if (type === "canvasBackground") return DEFAULT_CANVAS_BACKGROUND_PICKS;
    return null;
  });
</script>

{#if colors}
  <div class="color-picker__top-picks">
    {#each colors as color (color)}
      <button
        class={clsx("color-picker__button", {
          active: color === activeColor,
          "is-transparent": color === "transparent" || !color,
          "has-outline": !isColorDark(color, COLOR_OUTLINE_CONTRAST_THRESHOLD),
        })}
        style="--swatch-color: {color};"
        type="button"
        title={color}
        onclick={() => onChange(color)}
        data-testid={`color-top-pick-${color}`}
      >
        <div class="color-picker__button-outline"></div>
      </button>
    {/each}
  </div>
{/if}
