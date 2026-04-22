<script lang="ts">
  // Port of packages/excalidraw/components/ColorPicker/ColorInput.tsx
  //
  // The eye-dropper trigger is exposed via an optional `onEyeDropper`
  // callback + `eyeDropperActive` prop; the caller owns the eye-dropper
  // state + component.

  import clsx from "clsx";
  import { getContext } from "svelte";
  // @ts-ignore upstream
  import { KEYS, normalizeInputColor } from "@excalidraw/common";
  import type { EditorInterface } from "@excalidraw/common";
  import { EDITOR_INTERFACE_KEY } from "../../state/index.js";
  import { colorPickerSectionStore } from "../../state/colorPickerState.svelte.js";
  import Icon from "../../icons/Icon.svelte";

  let {
    color,
    onChange,
    label,
    placeholder,
    onEyeDropper,
    eyeDropperActive = false,
    eyeDropperTitle = "Pick color (I)",
  }: {
    color: string;
    onChange: (color: string) => void;
    label: string;
    placeholder?: string;
    onEyeDropper?: () => void;
    eyeDropperActive?: boolean;
    eyeDropperTitle?: string;
  } = $props();

  const editorInterface =
    getContext<EditorInterface | undefined>(EDITOR_INTERFACE_KEY);

  // svelte-ignore state_referenced_locally
  let innerValue = $state(color);
  $effect(() => {
    innerValue = color;
  });

  let inputEl: HTMLInputElement | null = $state(null);
  let eyeDropperTriggerEl: HTMLDivElement | null = $state(null);

  $effect(() => {
    if (inputEl && colorPickerSectionStore.section === "hex") {
      inputEl.focus();
    }
  });

  function changeColor(inputValue: string) {
    const value = inputValue.toLowerCase();
    const normalized = normalizeInputColor(value);
    if (normalized) onChange(normalized);
    innerValue = value;
  }
</script>

<div class="color-picker__input-label">
  <div class="color-picker__input-hash">#</div>
  <input
    bind:this={inputEl}
    style="border: 0; padding: 0;"
    spellcheck="false"
    class="color-picker-input"
    aria-label={label}
    oninput={(event) =>
      changeColor((event.target as HTMLInputElement).value)}
    value={(innerValue || "").replace(/^#/, "")}
    onblur={() => (innerValue = color)}
    tabindex="-1"
    onfocus={() => colorPickerSectionStore.set("hex")}
    onkeydown={(event) => {
      if (event.key === KEYS.TAB) return;
      if (event.key === KEYS.ESCAPE) eyeDropperTriggerEl?.focus();
      event.stopPropagation();
    }}
    {placeholder}
  />
  {#if editorInterface?.formFactor !== "phone" && onEyeDropper}
    <div
      style="width: 1px; height: 1.25rem; background-color: var(--default-border-color);"
    ></div>
    <div
      bind:this={eyeDropperTriggerEl}
      class={clsx("excalidraw-eye-dropper-trigger", {
        selected: eyeDropperActive,
      })}
      onclick={onEyeDropper}
      role="button"
      tabindex="0"
      onkeydown={(e) => e.key === "Enter" && onEyeDropper()}
      title={eyeDropperTitle}
    >
      <Icon name="eyeDropperIcon" />
    </div>
  {/if}
</div>
