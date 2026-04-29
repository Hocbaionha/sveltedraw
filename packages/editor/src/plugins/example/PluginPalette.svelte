<script lang="ts">
  // Demo side panel for the example plugin. Shown when the plugin's
  // toolbar button toggles `open`. Pure presentation — all behaviour is
  // wired through props from the plugin install function.

  type Props = {
    open: boolean;
    title: string;
    onClose: () => void;
    onPing: () => void;
    onClearScene: () => void;
    elementsCount: number;
  };

  let { open, title, onClose, onPing, onClearScene, elementsCount }: Props =
    $props();
</script>

{#if open}
  <div class="plugin-palette">
    <div class="plugin-palette__header">
      <span class="plugin-palette__title">{title}</span>
      <button
        type="button"
        class="plugin-palette__close"
        aria-label="Close"
        onclick={onClose}
      >×</button>
    </div>
    <div class="plugin-palette__body">
      <p>Scene currently has <strong>{elementsCount}</strong> element(s).</p>
      <button type="button" class="plugin-palette__btn" onclick={onPing}>
        Ping main menu
      </button>
      <button
        type="button"
        class="plugin-palette__btn plugin-palette__btn--danger"
        onclick={onClearScene}
      >
        Clear scene
      </button>
    </div>
  </div>
{/if}

<style>
  .plugin-palette {
    position: absolute;
    top: 100px;
    left: 12px;
    width: 240px;
    background: var(--island-bg-color, #fff);
    border: 1px solid var(--border-color-medium, #d1d4da);
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    padding: 0;
    font-size: 13px;
  }
  :global(.sveltedraw.theme--dark) .plugin-palette {
    background: #232329;
    border-color: #363636;
    color: #e5e7ea;
  }
  .plugin-palette__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color-medium, #e5e7ea);
  }
  :global(.sveltedraw.theme--dark) .plugin-palette__header {
    border-bottom-color: #363636;
  }
  .plugin-palette__title {
    font-weight: 600;
  }
  .plugin-palette__close {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    color: inherit;
    padding: 0 4px;
  }
  .plugin-palette__body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .plugin-palette__btn {
    padding: 6px 10px;
    background: var(--button-gray-1, #f1f3f5);
    border: 1px solid var(--border-color-medium, #d1d4da);
    border-radius: 6px;
    cursor: pointer;
    font: inherit;
    color: inherit;
  }
  .plugin-palette__btn:hover {
    background: var(--button-gray-2, #ced4da);
  }
  .plugin-palette__btn--danger {
    color: #e03131;
  }
  :global(.sveltedraw.theme--dark) .plugin-palette__btn {
    background: #2e2e36;
    border-color: #363636;
  }
  :global(.sveltedraw.theme--dark) .plugin-palette__btn:hover {
    background: #3b3a66;
  }
</style>
