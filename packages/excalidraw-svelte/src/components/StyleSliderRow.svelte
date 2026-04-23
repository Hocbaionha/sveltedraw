<script lang="ts">
  // A9: numeric-slider row inside the style panel. Used for line-height,
  // rotation angle, and any future scalar controls. Parent passes the
  // raw value + parse/format functions so this stays unit-agnostic.

  let {
    label,
    min,
    max,
    step,
    value,
    display,
    onInput,
    ariaLabel,
  }: {
    label: string;
    min: number;
    max: number;
    step: number;
    /** Current numeric value in the unit shown on the slider (e.g. degrees
     *  for rotation, multiplier for line-height). Parent is responsible
     *  for converting to element storage format inside onInput. */
    value: number;
    /** Text shown in the right-side read-out. Parent formats so decimal
     *  precision / unit suffix stays flexible (e.g. "1.25" or "90°"). */
    display: string;
    onInput: (next: number) => void;
    ariaLabel: string;
  } = $props();
</script>

<div class="sp-row">
  <div class="sp-label">{label}</div>
  <div class="sp-swatches sp-slider">
    <input
      type="range"
      {min}
      {max}
      {step}
      {value}
      aria-label={ariaLabel}
      oninput={(e) => onInput(parseFloat((e.currentTarget as HTMLInputElement).value))}
    />
    <span class="sp-slider-value">{display}</span>
  </div>
</div>
