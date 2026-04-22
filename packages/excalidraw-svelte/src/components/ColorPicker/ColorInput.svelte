<script lang="ts">
  // Port of packages/excalidraw/components/ColorPicker/ColorInput.tsx
  //
  // Contract: controlled input that syncs `innerValue` from the `color` prop
  // on external change, but keeps transient user input local until it
  // normalizes to a valid color (which fires `onChange`). The eye-dropper
  // button is hidden on phone form factor (EDITOR_INTERFACE_KEY context).

  import { getContext, untrack } from "svelte";
  // @ts-ignore — resolved by Vite alias; no tsconfig path to avoid upstream cascade
  import { KEYS, normalizeInputColor } from "@excalidraw/common";

  // TODO: replace these internal-package imports with a Svelte-native i18n /
  // shortcut module once one exists. Current paths resolve via Vite aliases.
  // @ts-ignore — internal path; use alias when build config is set up
  import { t } from "@excalidraw/excalidraw/i18n";
  // @ts-ignore — internal path
  import { getShortcutKey } from "@excalidraw/excalidraw/shortcut";

  import { EDITOR_STORE_KEY, EDITOR_INTERFACE_KEY } from "../../state/index.js";
  import type { EditorStore } from "../../state/index.js";
  // @ts-ignore — resolved by Vite alias; no tsconfig path to avoid upstream cascade
  import type { EditorInterface } from "@excalidraw/common";
  import type { ColorPickerType } from "../../state/editorStore.svelte.js";

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  type Props = {
    color: string;
    onChange: (color: string) => void;
    label: string;
    colorPickerType: ColorPickerType;
    placeholder?: string;
  };

  const { color, onChange, label, colorPickerType, placeholder }: Props =
    $props();

  // ---------------------------------------------------------------------------
  // Contexts
  // ---------------------------------------------------------------------------

  const editorStore = getContext<EditorStore>(EDITOR_STORE_KEY);

  /**
   * EDITOR_INTERFACE_KEY provides EditorInterface (formFactor, desktopUIMode…).
   * Falls back to a desktop-like default when not provided.
   */
  const editorInterface = getContext<EditorInterface | undefined>(
    EDITOR_INTERFACE_KEY,
  );
  const isPhone = editorInterface?.formFactor === "phone";

  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------

  /** Controlled inner value that tracks `color` but also accepts transient input */
  let innerValue = $state(untrack(() => color));

  /** Keep innerValue in sync when the parent prop changes */
  $effect(() => {
    innerValue = color;
  });

  // Cleanup: clear eye-dropper state when this component unmounts
  $effect(() => {
    return () => {
      editorStore.setActiveEyeDropper(null);
    };
  });

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const activeSection = $derived(editorStore.activeColorPickerSection);
  const eyeDropperState = $derived(editorStore.activeEyeDropper);

  // ---------------------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------------------

  let inputEl: HTMLInputElement | undefined = $state();
  let eyeDropperTriggerEl: HTMLDivElement | undefined = $state();

  /** Focus the hex input whenever the active section switches to "hex" */
  $effect(() => {
    if (activeSection === "hex") {
      inputEl?.focus();
    }
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function changeColor(inputValue: string) {
    const value = inputValue.toLowerCase();
    const normalizedColor = normalizeInputColor(value);
    if (normalizedColor) {
      onChange(normalizedColor);
    }
    innerValue = value;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === KEYS.TAB) {
      return;
    } else if (event.key === KEYS.ESCAPE) {
      eyeDropperTriggerEl?.focus();
    }
    event.stopPropagation();
  }

  function toggleEyeDropper() {
    editorStore.setActiveEyeDropper((s) =>
      s
        ? null
        : {
            keepOpenOnAlt: false,
            onSelect: (pickedColor) => onChange(pickedColor),
            colorPickerType,
          },
    );
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
    value={(innerValue || "").replace(/^#/, "")}
    oninput={(event) => {
      changeColor((event.target as HTMLInputElement).value);
    }}
    onblur={() => {
      innerValue = color;
    }}
    tabindex={-1}
    onfocus={() => editorStore.setActiveColorPickerSection("hex")}
    onkeydown={handleKeyDown}
    {placeholder}
  />

  <!-- Eye-dropper — hidden on phone form factor (TODO: better mobile UX) -->
  {#if !isPhone}
    <div
      style="width: 1px; height: 1.25rem; background-color: var(--default-border-color);"
    ></div>

    <div
      bind:this={eyeDropperTriggerEl}
      class="excalidraw-eye-dropper-trigger"
      class:selected={!!eyeDropperState}
      role="button"
      tabindex={0}
      title={`${t("labels.eyeDropper")} — ${KEYS.I.toLocaleUpperCase()} or ${getShortcutKey("Alt")} `}
      onclick={toggleEyeDropper}
      onkeydown={(e) => {
        if (e.key === KEYS.ENTER || e.key === " ") {
          e.preventDefault();
          toggleEyeDropper();
        }
      }}
    >
      <!--
        Eye-dropper SVG (inlined from packages/excalidraw/components/icons.tsx →
        eyeDropperIcon, which uses tablerIconProps: 24×24, stroke, no fill).
      -->
      <svg
        aria-hidden="true"
        focusable="false"
        role="img"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
        <path d="M11 7l6 6"></path>
        <path
          d="M4 16l11.7 -11.7a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4l-11.7 11.7h-4v-4z"
        ></path>
      </svg>
    </div>
  {/if}
</div>
