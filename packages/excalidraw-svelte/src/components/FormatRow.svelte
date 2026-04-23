<script lang="ts">
  // Text-format row: Bold / Italic / Underline / Strikethrough. Each
  // button toggles its field between two fixed values (not a multi-way
  // preset, so PresetIconRow doesn't fit). Renderer honors all four —
  // pixel-verified in the phase-16 text-styling commit.

  let {
    fontWeight,
    fontStyle,
    textDecoration,
    onApply,
  }: {
    fontWeight: string;
    fontStyle: string;
    textDecoration: string;
    onApply: (patch: {
      fontWeight?: string;
      fontStyle?: string;
      textDecoration?: string;
    }) => void;
  } = $props();
</script>

<div class="sp-row">
  <div class="sp-label">Format</div>
  <div class="sp-swatches">
    <button
      type="button"
      class="sp-icon-btn sp-format-btn"
      class:active={fontWeight === "bold"}
      data-preset="fontWeight"
      data-value="bold"
      aria-label="Bold"
      title="Bold"
      onclick={() => onApply({
        fontWeight: fontWeight === "bold" ? "normal" : "bold",
      })}
    >
      <strong>B</strong>
    </button>
    <button
      type="button"
      class="sp-icon-btn sp-format-btn"
      class:active={fontStyle === "italic"}
      data-preset="fontStyle"
      data-value="italic"
      aria-label="Italic"
      title="Italic"
      onclick={() => onApply({
        fontStyle: fontStyle === "italic" ? "normal" : "italic",
      })}
    >
      <em>I</em>
    </button>
    <button
      type="button"
      class="sp-icon-btn sp-format-btn"
      class:active={textDecoration === "underline"}
      data-preset="textDecoration"
      data-value="underline"
      aria-label="Underline"
      title="Underline"
      onclick={() => onApply({
        textDecoration: textDecoration === "underline" ? "none" : "underline",
      })}
    >
      <span style="text-decoration: underline">U</span>
    </button>
    <button
      type="button"
      class="sp-icon-btn sp-format-btn"
      class:active={textDecoration === "line-through"}
      data-preset="textDecoration"
      data-value="line-through"
      aria-label="Strikethrough"
      title="Strikethrough"
      onclick={() => onApply({
        textDecoration: textDecoration === "line-through" ? "none" : "line-through",
      })}
    >
      <span style="text-decoration: line-through">S</span>
    </button>
  </div>
</div>
