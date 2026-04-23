<script lang="ts">
  import type { LayoutConfig, LayoutType } from '../autolayout/types.js';
  import { t } from '../state/i18n.svelte.js';

  interface Props {
    selectedCount: number;
    onLayout: (config: LayoutConfig) => void;
  }

  let { selectedCount, onLayout }: Props = $props();

  let config = $state<LayoutConfig>({
    type: 'flowchart',
    direction: 'vertical',
    spacing: {
      horizontal: 30,
      vertical: 30,
    },
    alignment: 'center',
  });

  const layoutTypes: Array<{ value: LayoutType; label: string; description: string }> = [
    { value: 'flowchart', label: 'Flowchart', description: 'Sequential arrangement' },
    { value: 'grid', label: 'Grid', description: 'Rows and columns' },
    { value: 'circular', label: 'Circular', description: 'Around a center point' },
    { value: 'orgchart', label: 'Org Chart', description: 'Hierarchical tree' },
    { value: 'tree', label: 'Tree', description: 'Top-down hierarchy' },
  ];

  const alignmentOptions = ['start', 'center', 'end'] as const;
</script>

<div class="autolayout-panel">
  <div class="al-header">
    <h3 class="al-title">{t('sveltedraw.panels.autoLayoutTitle', undefined, 'Auto Layout')}</h3>
    {#if selectedCount > 0}
      <span class="al-count">{selectedCount}</span>
    {/if}
  </div>

  {#if selectedCount < 2}
    <div class="al-message">
      <p>{t('sveltedraw.panels.autoLayoutEmpty', undefined, 'Select 2+ shapes to apply automatic layout')}</p>
    </div>
  {:else}
    <div class="al-section">
      <p class="al-label">Layout Type:</p>
      <div class="al-type-buttons">
        {#each layoutTypes as layout}
          <button
            class="al-type-btn"
            class:active={config.type === layout.value}
            title={layout.description}
            onclick={() => (config.type = layout.value)}
          >
            {layout.label}
          </button>
        {/each}
      </div>
    </div>

    {#if config.type === 'flowchart' || config.type === 'orgchart' || config.type === 'tree'}
      <div class="al-section">
        <label class="al-label">
          <input
            type="radio"
            name="direction"
            value="vertical"
            checked={config.direction === 'vertical'}
            onchange={() => (config.direction = 'vertical')}
          />
          Vertical (Top-Down)
        </label>
        <label class="al-label">
          <input
            type="radio"
            name="direction"
            value="horizontal"
            checked={config.direction === 'horizontal'}
            onchange={() => (config.direction = 'horizontal')}
          />
          Horizontal (Left-Right)
        </label>
      </div>
    {/if}

    {#if config.type === 'flowchart'}
      <div class="al-section">
        <p class="al-label">Alignment:</p>
        <div class="al-alignment-buttons">
          {#each alignmentOptions as align}
            <button
              class="al-align-btn"
              class:active={config.alignment === align}
              title={`Align ${align}`}
              onclick={() => (config.alignment = align)}
            >
              {align.charAt(0).toUpperCase()}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="al-section">
      <div class="al-spacing">
        <label class="al-spacing-label">
          <span>Horizontal Spacing:</span>
          <input
            type="range"
            min="5"
            max="100"
            step="5"
            value={config.spacing.horizontal}
            onchange={(e) => (config.spacing.horizontal = parseInt(e.currentTarget.value))}
          />
          <span class="al-spacing-value">{config.spacing.horizontal}px</span>
        </label>
        <label class="al-spacing-label">
          <span>Vertical Spacing:</span>
          <input
            type="range"
            min="5"
            max="100"
            step="5"
            value={config.spacing.vertical}
            onchange={(e) => (config.spacing.vertical = parseInt(e.currentTarget.value))}
          />
          <span class="al-spacing-value">{config.spacing.vertical}px</span>
        </label>
      </div>
    </div>

    <button class="al-apply-btn" onclick={() => onLayout(config)}>
      Apply Layout
    </button>
  {/if}
</div>

<style>
  .autolayout-panel {
    padding: 12px;
    border-left: 1px solid #e5e7ea;
    background: white;
    font-size: 13px;
    max-height: 600px;
    overflow-y: auto;
  }

  :global(.excalidraw.theme--dark) .autolayout-panel {
    background: #232329;
    border-left-color: #363636;
    color: #e5e7ea;
  }

  .al-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7ea;
  }

  :global(.excalidraw.theme--dark) .al-header {
    border-bottom-color: #363636;
  }

  .al-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  :global(.excalidraw.theme--dark) .al-title {
    color: #e5e7ea;
  }

  .al-count {
    font-size: 11px;
    padding: 2px 6px;
    background: #6965db;
    color: white;
    border-radius: 3px;
  }

  .al-message {
    padding: 12px;
    background: #f5f5f5;
    border-radius: 4px;
    text-align: center;
  }

  :global(.excalidraw.theme--dark) .al-message {
    background: #2e2e36;
  }

  .al-message p {
    margin: 0;
    font-size: 12px;
    color: #666;
  }

  :global(.excalidraw.theme--dark) .al-message p {
    color: #aaa;
  }

  .al-section {
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #f0f0f0;
  }

  :global(.excalidraw.theme--dark) .al-section {
    border-bottom-color: #2e2e36;
  }

  .al-label {
    display: flex;
    align-items: center;
    margin-bottom: 6px;
    font-size: 12px;
    color: #333;
    cursor: pointer;
    gap: 6px;
  }

  :global(.excalidraw.theme--dark) .al-label {
    color: #e5e7ea;
  }

  .al-label input[type='radio'] {
    cursor: pointer;
  }

  .al-type-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .al-type-btn {
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

  :global(.excalidraw.theme--dark) .al-type-btn {
    background: #2e2e36;
    border-color: #363636;
    color: #e5e7ea;
  }

  .al-type-btn:hover {
    background: #f0f0f0;
    border-color: #6965db;
  }

  :global(.excalidraw.theme--dark) .al-type-btn:hover {
    background: #363636;
    border-color: #6965db;
  }

  .al-type-btn.active {
    background: #6965db;
    color: white;
    border-color: #6965db;
  }

  .al-alignment-buttons {
    display: flex;
    gap: 6px;
  }

  .al-align-btn {
    flex: 1;
    padding: 6px;
    border: 1px solid #d1d4da;
    border-radius: 4px;
    background: white;
    color: #333;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  :global(.excalidraw.theme--dark) .al-align-btn {
    background: #2e2e36;
    border-color: #363636;
    color: #e5e7ea;
  }

  .al-align-btn:hover {
    background: #f0f0f0;
    border-color: #6965db;
  }

  :global(.excalidraw.theme--dark) .al-align-btn:hover {
    background: #363636;
    border-color: #6965db;
  }

  .al-align-btn.active {
    background: #6965db;
    color: white;
    border-color: #6965db;
  }

  .al-spacing {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .al-spacing-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
  }

  .al-spacing-label span:first-child {
    min-width: 120px;
    color: #666;
  }

  :global(.excalidraw.theme--dark) .al-spacing-label span:first-child {
    color: #999;
  }

  .al-spacing-label input[type='range'] {
    flex: 1;
  }

  .al-spacing-value {
    min-width: 35px;
    text-align: right;
    color: #6965db;
    font-weight: 600;
  }

  .al-apply-btn {
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    background: #6965db;
    color: white;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .al-apply-btn:hover {
    background: #5754c7;
  }

  .al-apply-btn:active {
    background: #4a43b8;
  }
</style>
