<script lang="ts">
  // Bottom-right zoom cluster: −, percent (reset on click), +.
  type Props = {
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onReset: () => void;
  };

  let { zoom, onZoomIn, onZoomOut, onReset }: Props = $props();
</script>

<div class="sveltedraw-zoom-ctrls" role="toolbar" aria-label="Zoom">
  <button
    type="button"
    class="sveltedraw-zoom-btn"
    aria-label="Zoom out"
    title="Zoom out (Ctrl+-)"
    onclick={onZoomOut}
  >−</button>
  <button
    type="button"
    class="sveltedraw-zoom-btn sveltedraw-zoom-reset"
    aria-label="Reset zoom"
    title="Reset zoom (Ctrl+0)"
    onclick={onReset}
  >
    {Math.round(zoom * 100)}%
  </button>
  <button
    type="button"
    class="sveltedraw-zoom-btn"
    aria-label="Zoom in"
    title="Zoom in (Ctrl++)"
    onclick={onZoomIn}
  >+</button>
</div>

<style>
  .sveltedraw-zoom-ctrls {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    align-items: stretch;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
    z-index: 50;
    overflow: hidden;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-zoom-ctrls {
    background: #232329;
    border-color: #363636;
  }
  .sveltedraw-zoom-btn {
    width: 32px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: transparent;
    border: none;
    border-left: 1px solid #e5e7ea;
    cursor: pointer;
    font-size: 16px;
    color: #1e1e1e;
    font-variant-numeric: tabular-nums;
  }
  .sveltedraw-zoom-btn:first-child {
    border-left: none;
  }
  .sveltedraw-zoom-btn:hover {
    background: #f1f3f5;
  }
  .sveltedraw-zoom-reset {
    min-width: 52px;
    font-size: 12px;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-zoom-btn {
    color: #e5e7ea;
    border-left-color: #363636;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-zoom-btn:hover {
    background: #2e2e36;
  }
</style>
