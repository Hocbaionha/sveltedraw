<script lang="ts">
  // Edge style: sharp corners vs smooth curves. Doesn't fit PresetIconRow
  // because the callback isn't applyStyle({ ... }) — it calls
  // applyRoundnessToSelection which picks the right roundness.type per
  // element (ADAPTIVE for rectangles/diamonds, PROPORTIONAL for lines).

  let {
    hasRoundness,
    onSelect,
  }: {
    hasRoundness: boolean;
    onSelect: (round: boolean) => void;
  } = $props();
</script>

<div class="sp-row">
  <div class="sp-label">Edges</div>
  <div class="sp-swatches">
    <button
      type="button"
      class="sp-icon-btn"
      class:active={!hasRoundness}
      data-preset="edges"
      data-value="sharp"
      aria-label="Sharp"
      title="Sharp"
      onclick={() => onSelect(false)}
    >
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M4 14 L4 6 L16 6" stroke-linecap="round" stroke-linejoin="miter"/>
      </svg>
    </button>
    <button
      type="button"
      class="sp-icon-btn"
      class:active={hasRoundness}
      data-preset="edges"
      data-value="round"
      aria-label="Round"
      title="Round"
      onclick={() => onSelect(true)}
    >
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M4 14 Q4 6 10 6 L16 6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</div>
