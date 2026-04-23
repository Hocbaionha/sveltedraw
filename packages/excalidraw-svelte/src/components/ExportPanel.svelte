<script lang="ts">
  import type { ExportOptions, ExportPreset } from '../export/types.js';
  import { getDefaultExportOptions, EXPORT_PRESETS, getFormatLabel, getFormatExtension, validateExportOptions, estimateFileSize } from '../export/types.js';

  type Props = {
    options: ExportOptions;
    presets: ExportPreset[];
    elementCount: number;
    onExport: (options: ExportOptions) => void;
    onOptionsChange: (options: ExportOptions) => void;
    onPresetSelect: (preset: ExportPreset) => void;
    onClose: () => void;
  };

  let {
    options = getDefaultExportOptions(),
    presets = EXPORT_PRESETS,
    elementCount = 0,
    onExport,
    onOptionsChange,
    onPresetSelect,
    onClose,
  } = $props() as Props;

  let validationError = $derived.by(() => validateExportOptions(options));
  let estimatedSize = $derived(estimateFileSize(options, elementCount));
  let fileName = $derived(`${options.fileName}${getFormatExtension(options.format)}`);

  const handleExport = () => {
    if (validationError) return;
    onExport(options);
  };

  const updateOption = (key: keyof ExportOptions, value: any) => {
    const updated = { ...options, [key]: value };
    onOptionsChange(updated);
  };
</script>

<div class="export-panel-overlay" onclick={onClose}>
  <div class="export-panel" onclick={(e) => e.stopPropagation()}>
    <!-- Header -->
    <div class="ep-header">
      <h2 class="ep-title">Export Drawing</h2>
      <button
        class="ep-close-btn"
        aria-label="Close"
        onclick={onClose}
      >
        ✕
      </button>
    </div>

    <!-- Content -->
    <div class="ep-content">
      <!-- Format selection -->
      <div class="ep-section">
        <label class="ep-label">Format</label>
        <div class="ep-format-grid">
          {#each ['svg', 'png', 'pdf', 'json'] as format}
            <button
              class="ep-format-btn"
              class:active={options.format === format}
              onclick={() => updateOption('format', format)}
              title={getFormatLabel(format)}
            >
              <span class="ep-format-icon">
                {#if format === 'svg'}
                  ◇
                {:else if format === 'png'}
                  🖼️
                {:else if format === 'pdf'}
                  📄
                {:else}
                  ⚙️
                {/if}
              </span>
              <span class="ep-format-name">{format.toUpperCase()}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Presets -->
      <div class="ep-section">
        <label class="ep-label">Presets</label>
        <select
          class="ep-select"
          onchange={(e) => {
            const preset = presets.find(p => p.id === (e.target as HTMLSelectElement).value);
            if (preset) onPresetSelect(preset);
          }}
        >
          <option value="">Custom settings</option>
          {#each presets as preset (preset.id)}
            <option value={preset.id}>{preset.name}</option>
          {/each}
        </select>
      </div>

      <!-- Dimensions -->
      <div class="ep-section">
        <div class="ep-dimension-group">
          <div>
            <label class="ep-label">Width</label>
            <input
              type="number"
              class="ep-input"
              min="100"
              max="10000"
              value={options.width}
              onchange={(e) => updateOption('width', parseInt((e.target as HTMLInputElement).value))}
            />
          </div>
          <div>
            <label class="ep-label">Height</label>
            <input
              type="number"
              class="ep-input"
              min="100"
              max="10000"
              value={options.height}
              onchange={(e) => updateOption('height', parseInt((e.target as HTMLInputElement).value))}
            />
          </div>
          <div>
            <label class="ep-label">Scale</label>
            <input
              type="number"
              class="ep-input"
              min="0.1"
              max="5"
              step="0.1"
              value={options.scale}
              onchange={(e) => updateOption('scale', parseFloat((e.target as HTMLInputElement).value))}
            />
          </div>
        </div>
      </div>

      <!-- Quality slider (PNG only) -->
      {#if options.format === 'png'}
        <div class="ep-section">
          <label class="ep-label">
            Quality: {(options.quality * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            class="ep-slider"
            min="0.1"
            max="1"
            step="0.05"
            value={options.quality}
            onchange={(e) => updateOption('quality', parseFloat((e.target as HTMLInputElement).value))}
          />
        </div>
      {/if}

      <!-- File name -->
      <div class="ep-section">
        <label class="ep-label">File Name</label>
        <div class="ep-filename-input">
          <input
            type="text"
            class="ep-input"
            value={options.fileName}
            placeholder="drawing"
            onchange={(e) => updateOption('fileName', (e.target as HTMLInputElement).value)}
          />
          <span class="ep-extension">{getFormatExtension(options.format)}</span>
        </div>
      </div>

      <!-- Options -->
      <div class="ep-section">
        <label class="ep-checkbox">
          <input
            type="checkbox"
            checked={options.includeBackground}
            onchange={(e) => updateOption('includeBackground', (e.target as HTMLInputElement).checked)}
          />
          <span>Include background</span>
        </label>
        <label class="ep-checkbox">
          <input
            type="checkbox"
            checked={options.includeBorder}
            onchange={(e) => updateOption('includeBorder', (e.target as HTMLInputElement).checked)}
          />
          <span>Include border</span>
        </label>
      </div>

      <!-- Info -->
      <div class="ep-info">
        <div class="ep-info-item">
          <span>Estimated size:</span>
          <strong>{estimatedSize}</strong>
        </div>
        <div class="ep-info-item">
          <span>Elements:</span>
          <strong>{elementCount}</strong>
        </div>
      </div>

      <!-- Validation error -->
      {#if validationError}
        <div class="ep-error">
          ⚠️ {validationError}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="ep-footer">
      <button
        class="ep-btn ep-btn-secondary"
        onclick={onClose}
      >
        Cancel
      </button>
      <button
        class="ep-btn ep-btn-primary"
        disabled={!!validationError}
        onclick={handleExport}
      >
        💾 Export {fileName}
      </button>
    </div>
  </div>
</div>

<style>
  .export-panel-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
  }

  .export-panel {
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  :global(.excalidraw.theme--dark) .export-panel {
    background: #232329;
    color: #e5e7ea;
  }

  .ep-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid #e5e7ea;
  }

  :global(.excalidraw.theme--dark) .ep-header {
    border-bottom-color: #363636;
  }

  .ep-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }

  .ep-close-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .ep-close-btn:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  :global(.excalidraw.theme--dark) .ep-close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .ep-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .ep-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ep-label {
    font-size: 12px;
    font-weight: 600;
    color: #333;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  :global(.excalidraw.theme--dark) .ep-label {
    color: #aaa;
  }

  .ep-format-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .ep-format-btn {
    padding: 12px;
    border: 2px solid #e5e7ea;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
    font-size: 11px;
    color: #333;
  }

  :global(.excalidraw.theme--dark) .ep-format-btn {
    background: #2e2e36;
    border-color: #363636;
    color: #e5e7ea;
  }

  .ep-format-btn:hover {
    border-color: #6965db;
    background: #f8f8ff;
  }

  :global(.excalidraw.theme--dark) .ep-format-btn:hover {
    border-color: #7c7cff;
    background: #3a3a44;
  }

  .ep-format-btn.active {
    border-color: #6965db;
    background: #dde4f0;
    color: #6965db;
  }

  :global(.excalidraw.theme--dark) .ep-format-btn.active {
    border-color: #7c7cff;
    background: #2d3748;
    color: #7c7cff;
  }

  .ep-format-icon {
    font-size: 20px;
  }

  .ep-format-name {
    font-weight: 500;
  }

  .ep-select,
  .ep-input {
    padding: 8px 12px;
    border: 1px solid #d1d4da;
    border-radius: 4px;
    font-size: 12px;
    color: #333;
  }

  :global(.excalidraw.theme--dark) .ep-select,
  :global(.excalidraw.theme--dark) .ep-input {
    background: #2e2e36;
    border-color: #363636;
    color: #e5e7ea;
  }

  .ep-dimension-group {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .ep-filename-input {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .ep-filename-input .ep-input {
    flex: 1;
  }

  .ep-extension {
    font-size: 12px;
    color: #999;
    min-width: 40px;
  }

  :global(.excalidraw.theme--dark) .ep-extension {
    color: #666;
  }

  .ep-slider {
    width: 100%;
    cursor: pointer;
  }

  .ep-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 12px;
  }

  .ep-checkbox input {
    cursor: pointer;
  }

  .ep-info {
    display: flex;
    gap: 16px;
    padding: 12px;
    background: #f8f8ff;
    border-radius: 6px;
    font-size: 12px;
  }

  :global(.excalidraw.theme--dark) .ep-info {
    background: #2e2e36;
  }

  .ep-info-item {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    flex: 1;
  }

  .ep-error {
    padding: 12px;
    background: #ffe5e5;
    border-radius: 6px;
    color: #d32f2f;
    font-size: 12px;
  }

  :global(.excalidraw.theme--dark) .ep-error {
    background: #3a2222;
    color: #ff9999;
  }

  .ep-footer {
    display: flex;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid #e5e7ea;
    background: #f8f8f8;
  }

  :global(.excalidraw.theme--dark) .ep-footer {
    background: #1a1a1e;
    border-top-color: #363636;
  }

  .ep-btn {
    flex: 1;
    padding: 10px 16px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .ep-btn-primary {
    background: #6965db;
    color: white;
  }

  .ep-btn-primary:hover:not(:disabled) {
    background: #5a56c9;
  }

  .ep-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ep-btn-secondary {
    background: #e5e7ea;
    color: #333;
  }

  :global(.excalidraw.theme--dark) .ep-btn-secondary {
    background: #2e2e36;
    color: #e5e7ea;
  }

  .ep-btn-secondary:hover {
    background: #d1d4da;
  }

  :global(.excalidraw.theme--dark) .ep-btn-secondary:hover {
    background: #363636;
  }
</style>
