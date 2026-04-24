<script lang="ts">
  // Help dialog — keyboard shortcut reference. Overlay + card.
  // Extracted from App.svelte so the editor root stays focused on canvas/state.
  import { t } from "../state/i18n.svelte.js";

  type Props = {
    open: boolean;
    onClose: () => void;
  };

  let { open, onClose }: Props = $props();
</script>

{#if open}
  <div
    class="sveltedraw-help-overlay"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onpointerdown={onClose}
  >
    <div
      class="sveltedraw-help-card"
      role="document"
      onpointerdown={(e) => e.stopPropagation()}
    >
      <div class="hd-header">
        <strong>{t("helpDialog.title", undefined, "Keyboard shortcuts")}</strong>
        <button type="button" class="hd-close" aria-label="Close" onclick={onClose}>×</button>
      </div>
      <div class="hd-body">
        <div class="hd-section">
          <h4>Tools</h4>
          <div class="hd-row"><kbd>V</kbd>/<kbd>1</kbd><span>Selection</span></div>
          <div class="hd-row"><kbd>R</kbd>/<kbd>2</kbd><span>Rectangle</span></div>
          <div class="hd-row"><kbd>D</kbd>/<kbd>3</kbd><span>Diamond</span></div>
          <div class="hd-row"><kbd>O</kbd>/<kbd>4</kbd><span>Ellipse</span></div>
          <div class="hd-row"><kbd>A</kbd>/<kbd>5</kbd><span>Arrow</span></div>
          <div class="hd-row"><kbd>L</kbd>/<kbd>6</kbd><span>Line</span></div>
          <div class="hd-row"><kbd>P</kbd>/<kbd>7</kbd><span>Draw</span></div>
          <div class="hd-row"><kbd>T</kbd>/<kbd>8</kbd><span>Text</span></div>
        </div>
        <div class="hd-section">
          <h4>Edit</h4>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Z</kbd><span>Undo</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Y</kbd><span>Redo</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>A</kbd><span>Select all</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>D</kbd><span>Duplicate</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>G</kbd><span>Group</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd><span>Ungroup</span></div>
          <div class="hd-row"><kbd>Del</kbd><span>Delete</span></div>
          <div class="hd-row"><kbd>Alt</kbd>+drag<span>Duplicate while dragging</span></div>
        </div>
        <div class="hd-section">
          <h4>Z-order</h4>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>]</kbd><span>Bring forward</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>]</kbd><span>Bring to front</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>[</kbd><span>Send backward</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>[</kbd><span>Send to back</span></div>
        </div>
        <div class="hd-section">
          <h4>View</h4>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>0</kbd><span>Reset zoom</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>+</kbd><span>Zoom in</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>-</kbd><span>Zoom out</span></div>
          <div class="hd-row"><kbd>Space</kbd>+drag<span>Pan canvas</span></div>
          <div class="hd-row">Pinch<span>Zoom on touch</span></div>
        </div>
        <div class="hd-section">
          <h4>Export</h4>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>S</kbd><span>Export PNG</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd><span>Export SVG</span></div>
        </div>
        <div class="hd-section">
          <h4>Templates & Library</h4>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>N</kbd><span>New from template</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>R</kbd><span>Recent files</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>,</kbd><span>Settings</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>L</kbd><span>Toggle library</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd><span>New frame</span></div>
        </div>
        <div class="hd-section">
          <h4>Advanced Tools (Phase 13)</h4>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd><span>Connector tool</span></div>
          <h5 style="margin: 12px 0 8px; font-weight: 600; color: #666;">Alignment & Distribution</h5>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>L</kbd><span>Align left</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>C</kbd><span>Align center</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>R</kbd><span>Align right</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd><span>Align top</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd><span>Align middle</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>B</kbd><span>Align bottom</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd><span>Distribute horizontally</span></div>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd><span>Distribute vertically</span></div>
          <h5 style="margin: 12px 0 8px; font-weight: 600; color: #666;">Measurements & Dimensions</h5>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>M</kbd><span>Show/hide measurements panel</span></div>
          <h5 style="margin: 12px 0 8px; font-weight: 600; color: #666;">Auto-Layout</h5>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>L</kbd><span>Show/hide auto-layout panel</span></div>
          <h5 style="margin: 12px 0 8px; font-weight: 600; color: #666;">Advanced Text Features</h5>
          <div class="hd-row"><kbd>Ctrl</kbd>+<kbd>T</kbd><span>Show/hide text editor panel</span></div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .sveltedraw-help-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .sveltedraw-help-card {
    width: min(680px, 92vw);
    max-height: 85vh;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-size: 13px;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-help-card {
    background: #232329;
    color: #e5e7ea;
  }
  .hd-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid #e5e7ea;
    font-size: 16px;
  }
  :global(.excalidraw.theme--dark) .hd-header {
    border-bottom-color: #363636;
  }
  .hd-close {
    background: transparent;
    border: none;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    color: inherit;
  }
  .hd-body {
    padding: 16px 20px;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px 24px;
  }
  .hd-section h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6b7280;
  }
  .hd-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 0;
    color: #1e1e1e;
  }
  :global(.excalidraw.theme--dark) .hd-row {
    color: #e5e7ea;
  }
  .hd-row span {
    margin-left: auto;
    color: #6b7280;
  }
</style>
