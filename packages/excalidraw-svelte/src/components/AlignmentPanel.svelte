<script lang="ts">
  import type { AlignmentType, DistributionType } from '../alignment/types.js';

  interface Props {
    onAlign: (type: AlignmentType) => void;
    onDistribute: (type: DistributionType) => void;
    selectedCount: number;
  }

  let { onAlign, onDistribute, selectedCount }: Props = $props();

  const alignmentOptions: Array<{ type: AlignmentType; label: string; shortcut: string }> = [
    { type: 'left', label: 'Align Left', shortcut: 'Ctrl+Alt+L' },
    { type: 'centerH', label: 'Align Center', shortcut: 'Ctrl+Alt+C' },
    { type: 'right', label: 'Align Right', shortcut: 'Ctrl+Alt+R' },
    { type: 'top', label: 'Align Top', shortcut: 'Ctrl+Alt+T' },
    { type: 'centerV', label: 'Align Middle', shortcut: 'Ctrl+Alt+M' },
    { type: 'bottom', label: 'Align Bottom', shortcut: 'Ctrl+Alt+B' },
  ];

  const distributionOptions: Array<{ type: DistributionType; label: string; shortcut: string }> = [
    { type: 'distributeEvenlyH', label: 'Distribute Horizontally', shortcut: 'Ctrl+Shift+H' },
    { type: 'distributeEvenlyV', label: 'Distribute Vertically', shortcut: 'Ctrl+Shift+V' },
  ];
</script>

<div class="alignment-panel">
  <div class="ap-header">
    <h3 class="ap-title">Alignment & Distribution</h3>
    {#if selectedCount > 0}
      <span class="ap-count">{selectedCount} selected</span>
    {/if}
  </div>

  {#if selectedCount < 2}
    <div class="ap-message">
      <p>Select 2+ shapes to align or distribute them</p>
    </div>
  {:else}
    <div class="ap-section">
      <p class="ap-section-label">Align</p>
      <div class="ap-grid">
        {#each alignmentOptions as option}
          <button
            class="ap-btn"
            title="{option.label} ({option.shortcut})"
            onclick={() => onAlign(option.type)}
          >
            <span class="ap-btn-label">{option.label}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="ap-section">
      <p class="ap-section-label">Distribute</p>
      <div class="ap-grid">
        {#each distributionOptions as option}
          <button
            class="ap-btn"
            title="{option.label} ({option.shortcut})"
            onclick={() => onDistribute(option.type)}
          >
            <span class="ap-btn-label">{option.label}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="ap-guides">
      <p class="ap-guides-label">Smart Guides</p>
      <p class="ap-guides-info">Guides appear when shapes align within snap threshold</p>
    </div>
  {/if}
</div>

<style>
  .alignment-panel {
    padding: 12px;
    border-left: 1px solid #e5e7ea;
    background: white;
    font-size: 13px;
    max-height: 500px;
    overflow-y: auto;
  }

  :global(.excalidraw.theme--dark) .alignment-panel {
    background: #232329;
    border-left-color: #363636;
    color: #e5e7ea;
  }

  .ap-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7ea;
  }

  :global(.excalidraw.theme--dark) .ap-header {
    border-bottom-color: #363636;
  }

  .ap-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  :global(.excalidraw.theme--dark) .ap-title {
    color: #e5e7ea;
  }

  .ap-count {
    font-size: 11px;
    padding: 2px 6px;
    background: #6965db;
    color: white;
    border-radius: 3px;
  }

  .ap-message {
    padding: 12px;
    background: #f5f5f5;
    border-radius: 4px;
    text-align: center;
  }

  :global(.excalidraw.theme--dark) .ap-message {
    background: #2e2e36;
  }

  .ap-message p {
    margin: 0;
    font-size: 12px;
    color: #666;
  }

  :global(.excalidraw.theme--dark) .ap-message p {
    color: #aaa;
  }

  .ap-section {
    margin-bottom: 16px;
  }

  .ap-section-label {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  :global(.excalidraw.theme--dark) .ap-section-label {
    color: #999;
  }

  .ap-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .ap-btn {
    padding: 8px 6px;
    border: 1px solid #d1d4da;
    border-radius: 4px;
    background: white;
    color: #333;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  :global(.excalidraw.theme--dark) .ap-btn {
    background: #2e2e36;
    border-color: #363636;
    color: #e5e7ea;
  }

  .ap-btn:hover {
    background: #f0f0f0;
    border-color: #6965db;
  }

  :global(.excalidraw.theme--dark) .ap-btn:hover {
    background: #363636;
    border-color: #6965db;
  }

  .ap-btn:active {
    background: #6965db;
    color: white;
    border-color: #6965db;
  }

  .ap-btn-label {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ap-guides {
    margin-top: 12px;
    padding: 8px;
    background: #f5f5f5;
    border-radius: 4px;
    border-left: 3px solid #6965db;
  }

  :global(.excalidraw.theme--dark) .ap-guides {
    background: #2e2e36;
  }

  .ap-guides-label {
    margin: 0 0 4px;
    font-size: 11px;
    font-weight: 600;
    color: #6965db;
  }

  .ap-guides-info {
    margin: 0;
    font-size: 11px;
    color: #666;
    line-height: 1.4;
  }

  :global(.excalidraw.theme--dark) .ap-guides-info {
    color: #aaa;
  }
</style>
