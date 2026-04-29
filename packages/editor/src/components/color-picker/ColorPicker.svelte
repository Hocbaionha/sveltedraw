<script lang="ts">
  // SCSS sidecar (ColorPicker.scss) loaded globally by host app.
  //
  // Heavy simplifications (Phase 6 wraps the missing pieces):
  //  - `appState.openPopup` → `open` + `onToggle` props (controlled).
  //  - `stylesPanelMode` ("full"/"compact"/"mobile") → prop, defaults to "full".
  //  - EyeDropper coupling hoisted: caller provides `onEyeDropperToggle` +
  //    `eyeDropperActive` signal.
  //  - Text-editor caret-preservation (saveCaretPosition / restoreCaretPosition
  //    / temporarilyDisableTextEditorBlur) NOT ported — Phase 6 wrapper can
  //    wrap `onChange` with those.
  //  - `container` for PropertiesPopover comes from a prop (Phase 6 sources it
  //    from the Sveltedraw container ref).
  //  - i18n strings as props with English fallback.

  import type { Snippet } from "svelte";
  import clsx from "clsx";
  // @ts-ignore
  import { COLOR_PALETTE } from "@sveltedraw/common";
  import type { ColorTuple, ColorPaletteCustom } from "@sveltedraw/common";
  import type { SveltedrawElement } from "@sveltedraw/element/types";
  import { Popover as BitsPopover } from "bits-ui";
  import ButtonSeparator from "../ButtonSeparator.svelte";
  import PropertiesPopover from "../PropertiesPopover.svelte";
  import { colorPickerSectionStore } from "../../state/colorPickerState.svelte.js";
  import type { ColorPickerType } from "./colorPickerUtils.js";
  import TopPicks from "./TopPicks.svelte";
  import ColorPickerTrigger from "./ColorPickerTrigger.svelte";
  import PickerHeading from "./PickerHeading.svelte";
  import ColorInput from "./ColorInput.svelte";
  import Picker from "./Picker.svelte";

  let {
    type,
    color,
    onChange,
    label,
    elements,
    palette = COLOR_PALETTE,
    topPicks,
    updateData,
    stylesPanelMode = "full",
    open,
    onToggle,
    onClose,
    container,
    onEyeDropperToggle,
    eyeDropperActive = false,
    editingTextElement = false,
    hexCodeLabel = "Hex code",
    colorPlaceholder = "Color",
    colorPickerLabel = "Color picker",
  }: {
    type: ColorPickerType;
    color: string | null;
    onChange: (color: string) => void;
    label: string;
    elements: readonly SveltedrawElement[];
    palette?: ColorPaletteCustom | null;
    topPicks?: ColorTuple;
    updateData: (formData?: unknown) => void;
    stylesPanelMode?: "full" | "compact" | "mobile";
    /** Controlled: is this picker currently open? */
    open: boolean;
    /** Called when the trigger button is clicked. */
    onToggle: () => void;
    /** Called when the popover requests close (outside click / ESC). */
    onClose: () => void;
    container: HTMLElement | null;
    onEyeDropperToggle: (force?: boolean) => void;
    eyeDropperActive?: boolean;
    editingTextElement?: boolean;
    hexCodeLabel?: string;
    colorPlaceholder?: string;
    colorPickerLabel?: string;
  } = $props();

  const isCompactMode = $derived(stylesPanelMode !== "full");
  const isMobileMode = $derived(stylesPanelMode === "mobile");
</script>

<div>
  <div
    role="dialog"
    aria-modal="true"
    class={clsx("color-picker-container", {
      "color-picker-container--no-top-picks": isCompactMode,
    })}
  >
    {#if !isCompactMode}
      <TopPicks activeColor={color} {onChange} {type} {topPicks} />
      <ButtonSeparator />
    {/if}
    <BitsPopover.Root
      bind:open={() => open, (v) => !v && onClose()}
    >
      <ColorPickerTrigger
        {color}
        {label}
        {type}
        mode={type === "elementStroke" ? "stroke" : "background"}
        {onToggle}
        {isCompactMode}
        {isMobileMode}
      />
      {#if open}
        <PropertiesPopover
          {container}
          style="max-width: 13rem;"
          preventAutoFocusOnTouch={editingTextElement}
          onClose={() => {
            onClose();
            colorPickerSectionStore.set(null);
          }}
        >
          {#if palette}
            <Picker
              {palette}
              {color}
              {onChange}
              {onEyeDropperToggle}
              onEscape={() => {
                if (eyeDropperActive) {
                  onEyeDropperToggle(false);
                } else {
                  onClose();
                }
              }}
              {type}
              {elements}
              {updateData}
              showTitle={isCompactMode}
              showHotKey={!isMobileMode}
              {colorPickerLabel}
            >
              {#snippet children()}
                <div>
                  <PickerHeading>
                    {#snippet children()}{hexCodeLabel}{/snippet}
                  </PickerHeading>
                  <ColorInput
                    color={color || ""}
                    {label}
                    {onChange}
                    placeholder={colorPlaceholder}
                    onEyeDropper={() => onEyeDropperToggle()}
                    {eyeDropperActive}
                  />
                </div>
              {/snippet}
            </Picker>
          {:else}
            <div>
              <PickerHeading>
                {#snippet children()}{hexCodeLabel}{/snippet}
              </PickerHeading>
              <ColorInput
                color={color || ""}
                {label}
                {onChange}
                placeholder={colorPlaceholder}
                onEyeDropper={() => onEyeDropperToggle()}
                {eyeDropperActive}
              />
            </div>
          {/if}
        </PropertiesPopover>
      {/if}
    </BitsPopover.Root>
  </div>
</div>
