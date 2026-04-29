<script lang="ts">
  // C1: drop shadow row. Three one-click presets (None / Soft / Hard).
  // Parent owns applyStyle + panelStyle — we only emit patches.

  type ShadowConfig = {
    color: string;
    offsetX: number;
    offsetY: number;
    blur: number;
  };

  // Original preset values — keep in sync with any shadow editor UI
  // that ships later (custom color/offset/blur sliders, etc.).
  const SOFT: ShadowConfig = {
    color: "rgba(0,0,0,0.25)",
    offsetX: 4,
    offsetY: 4,
    blur: 8,
  };
  const HARD: ShadowConfig = { color: "#000", offsetX: 6, offsetY: 6, blur: 0 };

  let {
    current,
    onApply,
  }: {
    current: ShadowConfig | null;
    onApply: (shadow: ShadowConfig | null) => void;
  } = $props();
</script>

<div class="sp-row">
  <div class="sp-label">Shadow</div>
  <div class="sp-swatches">
    <button
      type="button"
      class="sp-icon-btn"
      class:active={!current}
      title="None"
      aria-label="Shadow none"
      onclick={() => onApply(null)}
    >∅</button>
    <button
      type="button"
      class="sp-icon-btn"
      title="Soft"
      aria-label="Shadow soft"
      onclick={() => onApply(SOFT)}
    >◌</button>
    <button
      type="button"
      class="sp-icon-btn"
      title="Hard"
      aria-label="Shadow hard"
      onclick={() => onApply(HARD)}
    >●</button>
  </div>
</div>
