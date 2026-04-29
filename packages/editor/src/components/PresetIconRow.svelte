<script lang="ts" generics="T extends { value: any; name: string; icon?: string }">
  // Style-panel row rendering an icon button for each preset in an array.
  // Used by StrokeStyle / Fill / Sloppiness — any row where the choice is
  // a fixed enum with a label + icon, and selection maps straight to a
  // mutateElement patch via applyStyle. Rows that need a custom icon
  // renderer (e.g. StrokeStyle's "solid" → <StrokeStyleSolidIcon /> instead
  // of <Icon name="..." />) pass the `iconFor` snippet to override.
  import type { Snippet } from "svelte";
  import Icon from "../icons/Icon.svelte";

  let {
    label,
    presets,
    current,
    dataPreset,
    ariaLabelPrefix,
    onSelect,
    iconFor,
    btnClass = "sp-icon-btn",
  }: {
    label: string;
    presets: ReadonlyArray<T>;
    /** Current selected value. A preset is active when `p.value === current`. */
    current: unknown;
    /** data-preset attr for the button (used by test + devtools). */
    dataPreset: string;
    /** `${prefix} ${preset.name}` → full aria-label. */
    ariaLabelPrefix: string;
    onSelect: (value: T["value"]) => void;
    /** Optional custom icon renderer; receives the preset object. */
    iconFor?: Snippet<[T]>;
    /** CSS class for the button. Defaults to sp-icon-btn; stroke-width uses
     *  sp-width, opacity uses sp-opacity — same structure, different sizing. */
    btnClass?: string;
  } = $props();
</script>

<div class="sp-row">
  <div class="sp-label">{label}</div>
  <div class="sp-swatches">
    {#each presets as p}
      <button
        type="button"
        class={btnClass}
        class:active={current === p.value}
        data-preset={dataPreset}
        data-value={p.value}
        aria-label={ariaLabelPrefix ? `${ariaLabelPrefix} ${p.name}` : p.name}
        onclick={() => onSelect(p.value)}
      >
        {#if iconFor}{@render iconFor(p)}{:else if p.icon}<Icon name={p.icon} />{/if}
      </button>
    {/each}
  </div>
</div>
