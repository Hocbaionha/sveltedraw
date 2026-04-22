<script lang="ts">
  import clsx from "clsx";
  import HotkeyLabel from "./HotkeyLabel.svelte";
  import { colorPickerSectionStore } from "../../state/colorPickerState.svelte.js";

  let {
    colors,
    color,
    onChange,
    label,
  }: {
    colors: string[];
    color: string | null;
    onChange: (color: string) => void;
    label: string;
  } = $props();

  const buttons: HTMLButtonElement[] = [];
  $effect(() => {
    const idx = color != null ? colors.indexOf(color) : -1;
    if (idx >= 0 && buttons[idx]) buttons[idx].focus();
  });
</script>

<div class="color-picker-content--default">
  {#each colors as c, i (i)}
    <button
      bind:this={() => buttons[i], (el) => el && (buttons[i] = el)}
      tabindex="-1"
      type="button"
      class={clsx(
        "color-picker__button color-picker__button--large has-outline",
        {
          active: color === c,
          "is-transparent": c === "transparent" || !c,
        },
      )}
      onclick={() => {
        onChange(c);
        colorPickerSectionStore.set("custom");
      }}
      title={c}
      aria-label={label}
      style="--swatch-color: {c};"
    >
      <div class="color-picker__button-outline"></div>
      <HotkeyLabel color={c} keyLabel={i + 1} />
    </button>
  {/each}
</div>
