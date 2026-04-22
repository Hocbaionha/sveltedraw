<script lang="ts">
  import clsx from "clsx";
  // @ts-ignore upstream
  import { COLOR_OUTLINE_CONTRAST_THRESHOLD, isColorDark } from "@excalidraw/common";
  import { Popover as BitsPopover } from "bits-ui";
  import Icon from "../../icons/Icon.svelte";
  import type { ColorPickerType } from "./colorPickerUtils.js";

  let {
    color,
    label,
    type,
    mode = "background",
    onToggle,
    isCompactMode = false,
    isMobileMode = false,
    strokeTitle = "Stroke",
    backgroundTitle = "Background",
  }: {
    color: string | null;
    label: string;
    type: ColorPickerType;
    mode?: "background" | "stroke";
    onToggle: () => void;
    isCompactMode?: boolean;
    isMobileMode?: boolean;
    strokeTitle?: string;
    backgroundTitle?: string;
  } = $props();
</script>

<BitsPopover.Trigger>
  {#snippet child({ props })}
    <button
      {...props}
      type="button"
      class={clsx("color-picker__button active-color properties-trigger", {
        "is-transparent": !color || color === "transparent",
        "has-outline":
          !color || !isColorDark(color, COLOR_OUTLINE_CONTRAST_THRESHOLD),
        "compact-sizing": isCompactMode,
        "mobile-border": isMobileMode,
      })}
      aria-label={label}
      style={color ? `--swatch-color: ${color};` : undefined}
      title={type === "elementStroke" ? strokeTitle : backgroundTitle}
      data-openpopup={type}
      onclick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      <div class="color-picker__button-outline">
        {#if !color}
          <Icon name="slashIcon" />
        {/if}
      </div>
      {#if isCompactMode && color && mode === "stroke"}
        <div class="color-picker__button-background">
          <span
            style="color: {isColorDark(color, COLOR_OUTLINE_CONTRAST_THRESHOLD)
              ? '#fff'
              : '#111'};"
          >
            <Icon name="strokeIcon" />
          </span>
        </div>
      {/if}
    </button>
  {/snippet}
</BitsPopover.Trigger>
