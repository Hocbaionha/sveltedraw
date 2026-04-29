<script lang="ts">
  // A8/C2: lock + flip actions for the current selection. Parent owns
  // the actual mutators (toggleLockSelected, flipSelected) and passes
  // `anyLocked` so the lock glyph can flip between 🔒/🔓 reactively.

  let {
    anyLocked,
    onToggleLock,
    onFlip,
  }: {
    anyLocked: boolean;
    onToggleLock: () => void;
    onFlip: (axis: "horizontal" | "vertical") => void;
  } = $props();
</script>

<div class="sp-row">
  <div class="sp-label">Actions</div>
  <div class="sp-swatches">
    <button
      type="button"
      class="sp-icon-btn"
      aria-label="Toggle lock"
      title="Lock/unlock (Ctrl+Shift+L)"
      onclick={onToggleLock}
    >
      {anyLocked ? "🔒" : "🔓"}
    </button>
    <button
      type="button"
      class="sp-icon-btn"
      aria-label="Flip horizontal"
      title="Flip horizontal"
      onclick={() => onFlip("horizontal")}
    >⇔</button>
    <button
      type="button"
      class="sp-icon-btn"
      aria-label="Flip vertical"
      title="Flip vertical"
      onclick={() => onFlip("vertical")}
    >⇕</button>
  </div>
</div>
