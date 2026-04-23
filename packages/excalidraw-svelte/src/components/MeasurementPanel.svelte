<script lang="ts">
  import type { MeasurementConfig } from '../measurements/types.js';
  import { getMeasurementSummary } from '../measurements/types.js';
  import { t } from '../state/i18n.svelte.js';

  interface Element {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    angle?: number;
    [key: string]: unknown;
  }

  interface Props {
    selectedElements: Element[];
    config: MeasurementConfig;
    onConfigChange: (config: MeasurementConfig) => void;
  }

  let { selectedElements, config, onConfigChange }: Props = $props();

  const unitOptions: Array<{ value: 'px' | 'mm' | 'cm' | 'in'; label: string }> = [
    { value: 'px', label: 'Pixels' },
    { value: 'mm', label: 'Millimeters' },
    { value: 'cm', label: 'Centimeters' },
    { value: 'in', label: 'Inches' },
  ];

  const summary = $derived(getMeasurementSummary(selectedElements, config.unit));

  const toggleShowRulers = () => {
    onConfigChange({ ...config, showRulers: !config.showRulers });
  };

  const toggleShowDistances = () => {
    onConfigChange({ ...config, showDistances: !config.showDistances });
  };

  const toggleShowDimensions = () => {
    onConfigChange({ ...config, showDimensions: !config.showDimensions });
  };
</script>

<div class="measurement-panel">
  <div class="mp-header">
    <h3 class="mp-title">{t('sveltedraw.panels.measurementsTitle', undefined, 'Measurements')}</h3>
    {#if selectedElements.length > 0}
      <span class="mp-count">{selectedElements.length}</span>
    {/if}
  </div>

  <div class="mp-section">
    <label class="mp-label">
      <input
        type="checkbox"
        checked={config.showRulers}
        onchange={toggleShowRulers}
        aria-label="Show rulers"
      />
      <span>{t('sveltedraw.panels.showRulers', undefined, 'Show Rulers')}</span>
    </label>
    <label class="mp-label">
      <input
        type="checkbox"
        checked={config.showDistances}
        onchange={toggleShowDistances}
        aria-label="Show distances"
      />
      <span>{t('sveltedraw.panels.showDistances', undefined, 'Show Distances')}</span>
    </label>
    <label class="mp-label">
      <input
        type="checkbox"
        checked={config.showDimensions}
        onchange={toggleShowDimensions}
        aria-label="Show dimensions"
      />
      <span>{t('sveltedraw.panels.showDimensions', undefined, 'Show Dimensions')}</span>
    </label>
  </div>

  <div class="mp-section">
    <label for="unit-select" class="mp-label">Unit:</label>
    <select
      id="unit-select"
      class="mp-select"
      value={config.unit}
      onchange={(e) => onConfigChange({ ...config, unit: e.currentTarget.value as any })}
    >
      {#each unitOptions as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  </div>

  {#if selectedElements.length > 0 && summary}
    <div class="mp-measurements">
      <p class="mp-section-label">Dimensions</p>
      {#if selectedElements.length === 1}
        <div class="mp-item">
          <span class="mp-item-label">Width:</span>
          <span class="mp-item-value">{summary.width}</span>
        </div>
        <div class="mp-item">
          <span class="mp-item-label">Height:</span>
          <span class="mp-item-value">{summary.height}</span>
        </div>
        <div class="mp-item">
          <span class="mp-item-label">Area:</span>
          <span class="mp-item-value">{summary.area}</span>
        </div>
      {:else}
        <div class="mp-item">
          <span class="mp-item-label">Bounding Width:</span>
          <span class="mp-item-value">{summary.boundingWidth}</span>
        </div>
        <div class="mp-item">
          <span class="mp-item-label">Bounding Height:</span>
          <span class="mp-item-value">{summary.boundingHeight}</span>
        </div>
        <div class="mp-item">
          <span class="mp-item-label">Bounding Area:</span>
          <span class="mp-item-value">{summary.boundingArea}</span>
        </div>
      {/if}
    </div>
  {:else}
    <div class="mp-message">
      <p>Select one or more shapes to see measurements</p>
    </div>
  {/if}
</div>

<style>
  .measurement-panel {
    padding: 12px;
    border-left: 1px solid #e5e7ea;
    background: white;
    font-size: 13px;
    max-height: 500px;
    overflow-y: auto;
  }

  :global(.excalidraw.theme--dark) .measurement-panel {
    background: #232329;
    border-left-color: #363636;
    color: #e5e7ea;
  }

  .mp-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7ea;
  }

  :global(.excalidraw.theme--dark) .mp-header {
    border-bottom-color: #363636;
  }

  .mp-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  :global(.excalidraw.theme--dark) .mp-title {
    color: #e5e7ea;
  }

  .mp-count {
    font-size: 11px;
    padding: 2px 6px;
    background: #6965db;
    color: white;
    border-radius: 3px;
  }

  .mp-section {
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #f0f0f0;
  }

  :global(.excalidraw.theme--dark) .mp-section {
    border-bottom-color: #2e2e36;
  }

  .mp-section:last-of-type {
    border-bottom: none;
  }

  .mp-label {
    display: flex;
    align-items: center;
    margin-bottom: 6px;
    font-size: 12px;
    color: #333;
    cursor: pointer;
    gap: 6px;
  }

  :global(.excalidraw.theme--dark) .mp-label {
    color: #e5e7ea;
  }

  .mp-label input[type='checkbox'] {
    cursor: pointer;
  }

  .mp-select {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #d1d4da;
    border-radius: 4px;
    background: white;
    color: inherit;
    font-size: 12px;
  }

  :global(.excalidraw.theme--dark) .mp-select {
    background: #2e2e36;
    border-color: #363636;
  }

  .mp-message {
    padding: 12px;
    background: #f5f5f5;
    border-radius: 4px;
    text-align: center;
  }

  :global(.excalidraw.theme--dark) .mp-message {
    background: #2e2e36;
  }

  .mp-message p {
    margin: 0;
    font-size: 12px;
    color: #666;
  }

  :global(.excalidraw.theme--dark) .mp-message p {
    color: #aaa;
  }

  .mp-measurements {
    margin-top: 12px;
    padding: 8px;
    background: #f5f5f5;
    border-radius: 4px;
  }

  :global(.excalidraw.theme--dark) .mp-measurements {
    background: #2e2e36;
  }

  .mp-section-label {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  :global(.excalidraw.theme--dark) .mp-section-label {
    color: #999;
  }

  .mp-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid #e5e7ea;
    font-size: 12px;
  }

  :global(.excalidraw.theme--dark) .mp-item {
    border-bottom-color: #363636;
  }

  .mp-item:last-child {
    border-bottom: none;
  }

  .mp-item-label {
    color: #666;
    font-weight: 500;
  }

  :global(.excalidraw.theme--dark) .mp-item-label {
    color: #999;
  }

  .mp-item-value {
    color: #6965db;
    font-weight: 600;
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  }
</style>
