<script lang="ts">
  import { t } from '../state/i18n.svelte.js';

  type Props = {
    hasFirstPick: boolean;
    onCancel: () => void;
  };

  let { hasFirstPick, onCancel }: Props = $props();
</script>

<div class="ct-panel">
  <div class="ct-header">
    <strong>{t('sveltedraw.panels.connectShapes', undefined, 'Connect Shapes')}</strong>
    <button class="ct-cancel" aria-label="Cancel" onclick={onCancel}>✕</button>
  </div>
  <div class="ct-step" class:ct-step-active={!hasFirstPick}>
    <span class="ct-num">1</span>
    {t('sveltedraw.panels.connectorStep1', undefined, 'Click the first shape')}
  </div>
  <div class="ct-step" class:ct-step-active={hasFirstPick}>
    <span class="ct-num">2</span>
    {t('sveltedraw.panels.connectorStep2', undefined, 'Click the second shape')}
  </div>
  <div class="ct-hint">
    An arrow is created with bindings on both ends — moving either shape
    re-routes the connection automatically.
  </div>
</div>

<style>
  .ct-panel {
    padding: 12px 14px;
    font-size: 13px;
    color: #1e1e1e;
  }
  :global(.excalidraw.theme--dark) .ct-panel {
    color: #e5e7ea;
  }
  .ct-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7ea;
  }
  :global(.excalidraw.theme--dark) .ct-header {
    border-bottom-color: #363636;
  }
  .ct-cancel {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    color: #999;
    padding: 2px 6px;
    border-radius: 3px;
  }
  .ct-cancel:hover {
    background: rgba(0, 0, 0, 0.08);
  }
  :global(.excalidraw.theme--dark) .ct-cancel:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  .ct-step {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 6px 4px;
    color: #666;
    font-size: 12px;
  }
  :global(.excalidraw.theme--dark) .ct-step {
    color: #aaa;
  }
  .ct-step-active {
    color: #1e1e1e;
    font-weight: 600;
  }
  :global(.excalidraw.theme--dark) .ct-step-active {
    color: #e5e7ea;
  }
  .ct-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #e5e7ea;
    color: #666;
    font-weight: 600;
    font-size: 11px;
  }
  :global(.excalidraw.theme--dark) .ct-num {
    background: #2e2e36;
    color: #aaa;
  }
  .ct-step-active .ct-num {
    background: #6965db;
    color: white;
  }
  .ct-hint {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #f0f0f0;
    color: #666;
    font-size: 11px;
    line-height: 1.5;
  }
  :global(.excalidraw.theme--dark) .ct-hint {
    border-top-color: #2e2e36;
    color: #888;
  }
</style>
