<script lang="ts">
  import type { GridConfig, SnapConfig } from '../snap/types.js';
  import { t } from '../state/i18n.svelte.js';

  type Props = {
    gridConfig: GridConfig;
    snapConfig: SnapConfig;
    onGridConfigChange: (config: GridConfig) => void;
    onSnapConfigChange: (config: SnapConfig) => void;
  };

  const props: Props = $props();

  const gridSizes = [10, 15, 20, 25, 30, 50];
  const thresholds = [4, 6, 8, 10, 12, 16];
</script>

<div class="grid-panel">
  <div class="gp-header">
    <h3 class="gp-title">{t('sveltedraw.panels.gridSnapTitle', undefined, 'Grid & Snap')}</h3>
  </div>

  <!-- Grid Section -->
  <div class="gp-section">
    <div class="gp-toggle">
      <label class="gp-label">
        <input
          type="checkbox"
          checked={props.gridConfig.enabled}
          onchange={(e) =>
            props.onGridConfigChange({
              ...props.gridConfig,
              enabled: e.currentTarget.checked,
            })}
        />
        <span>{t('sveltedraw.panels.enableGrid', undefined, 'Enable Grid')}</span>
      </label>
    </div>

    {#if props.gridConfig.enabled}
      <div class="gp-control">
        <label class="gp-label" for="grid-size">Grid Size:</label>
        <select
          id="grid-size"
          class="gp-select"
          value={props.gridConfig.size}
          onchange={(e) =>
            props.onGridConfigChange({
              ...props.gridConfig,
              size: parseInt(e.currentTarget.value),
            })}
        >
          {#each gridSizes as size}
            <option value={size}>{size}px</option>
          {/each}
        </select>
      </div>

      <div class="gp-control">
        <label class="gp-label">
          <span>Show Grid:</span>
          <input
            type="checkbox"
            checked={props.gridConfig.visible}
            onchange={(e) =>
              props.onGridConfigChange({
                ...props.gridConfig,
                visible: e.currentTarget.checked,
              })}
          />
        </label>
      </div>

      {#if props.gridConfig.visible}
        <div class="gp-control">
          <label class="gp-label">
            <span>Grid Opacity:</span>
            <input
              type="range"
              min="0.05"
              max="0.5"
              step="0.05"
              value={props.gridConfig.opacity}
              onchange={(e) =>
                props.onGridConfigChange({
                  ...props.gridConfig,
                  opacity: parseFloat(e.currentTarget.value),
                })}
            />
            <span class="gp-value">{(props.gridConfig.opacity * 100).toFixed(0)}%</span>
          </label>
        </div>
      {/if}
    {/if}
  </div>

  <!-- Snap Section -->
  <div class="gp-section">
    <div class="gp-toggle">
      <label class="gp-label">
        <input
          type="checkbox"
          checked={props.snapConfig.enabled}
          onchange={(e) =>
            props.onSnapConfigChange({
              ...props.snapConfig,
              enabled: e.currentTarget.checked,
            })}
        />
        <span>Enable Snap</span>
      </label>
    </div>

    {#if props.snapConfig.enabled}
      <div class="gp-control">
        <label class="gp-label" for="snap-threshold">Snap Distance:</label>
        <select
          id="snap-threshold"
          class="gp-select"
          value={props.snapConfig.threshold}
          onchange={(e) =>
            props.onSnapConfigChange({
              ...props.snapConfig,
              threshold: parseInt(e.currentTarget.value),
            })}
        >
          {#each thresholds as threshold}
            <option value={threshold}>{threshold}px</option>
          {/each}
        </select>
      </div>

      <div class="gp-control">
        <label class="gp-label">
          <input
            type="checkbox"
            checked={props.snapConfig.guides}
            onchange={(e) =>
              props.onSnapConfigChange({
                ...props.snapConfig,
                guides: e.currentTarget.checked,
              })}
          />
          <span>Show Snap Guides</span>
        </label>
      </div>

      <!-- Snap Preferences — Phase 14 Feature 4 -->
      <div class="gp-divider">
        <strong class="gp-small-title">Snap Types</strong>
      </div>

      <div class="gp-control">
        <label class="gp-label">
          <input
            type="checkbox"
            checked={props.snapConfig.snapToGrid ?? true}
            onchange={(e) =>
              props.onSnapConfigChange({
                ...props.snapConfig,
                snapToGrid: e.currentTarget.checked,
              })}
          />
          <span>Snap to Grid</span>
        </label>
      </div>

      <div class="gp-control">
        <label class="gp-label">
          <input
            type="checkbox"
            checked={props.snapConfig.snapToElements ?? true}
            onchange={(e) =>
              props.onSnapConfigChange({
                ...props.snapConfig,
                snapToElements: e.currentTarget.checked,
              })}
          />
          <span>Snap to Elements</span>
        </label>
      </div>

      <div class="gp-control">
        <label class="gp-label">
          <input
            type="checkbox"
            checked={props.snapConfig.snapEdges ?? true}
            onchange={(e) =>
              props.onSnapConfigChange({
                ...props.snapConfig,
                snapEdges: e.currentTarget.checked,
              })}
          />
          <span>Snap Edges</span>
        </label>
      </div>

      <div class="gp-control">
        <label class="gp-label">
          <input
            type="checkbox"
            checked={props.snapConfig.snapCenters ?? true}
            onchange={(e) =>
              props.onSnapConfigChange({
                ...props.snapConfig,
                snapCenters: e.currentTarget.checked,
              })}
          />
          <span>Snap Centers</span>
        </label>
      </div>

      <div class="gp-control">
        <label class="gp-label">
          <input
            type="checkbox"
            checked={props.snapConfig.showDistance ?? true}
            onchange={(e) =>
              props.onSnapConfigChange({
                ...props.snapConfig,
                showDistance: e.currentTarget.checked,
              })}
          />
          <span>Show Distance</span>
        </label>
      </div>
    {/if}
  </div>
</div>

<style>
  .grid-panel {
    padding: 12px;
    border-left: 1px solid #e5e7ea;
    background: white;
    font-size: 13px;
    max-height: 400px;
    overflow-y: auto;
  }

  :global(.sveltedraw.theme--dark) .grid-panel {
    background: #232329;
    border-left-color: #363636;
    color: #e5e7ea;
  }

  .gp-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7ea;
  }

  :global(.sveltedraw.theme--dark) .gp-header {
    border-bottom-color: #363636;
  }

  .gp-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  :global(.sveltedraw.theme--dark) .gp-title {
    color: #e5e7ea;
  }

  .gp-section {
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #f0f0f0;
  }

  :global(.sveltedraw.theme--dark) .gp-section {
    border-bottom-color: #2e2e36;
  }

  .gp-toggle {
    margin-bottom: 8px;
  }

  .gp-control {
    margin-bottom: 8px;
  }

  .gp-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #333;
    font-weight: 500;
  }

  :global(.sveltedraw.theme--dark) .gp-label {
    color: #e5e7ea;
  }

  .gp-label input[type='checkbox'] {
    cursor: pointer;
  }

  .gp-label input[type='range'] {
    flex: 1;
    min-width: 60px;
  }

  .gp-value {
    min-width: 35px;
    text-align: right;
    color: #6965db;
    font-weight: 600;
  }

  .gp-select {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #d1d4da;
    border-radius: 4px;
    background: white;
    color: inherit;
    font-size: 12px;
  }

  :global(.sveltedraw.theme--dark) .gp-select {
    background: #2e2e36;
    border-color: #363636;
  }

  .gp-divider {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid #f0f0f0;
  }

  :global(.sveltedraw.theme--dark) .gp-divider {
    border-top-color: #2e2e36;
  }

  .gp-small-title {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  :global(.sveltedraw.theme--dark) .gp-small-title {
    color: #999;
  }
</style>
