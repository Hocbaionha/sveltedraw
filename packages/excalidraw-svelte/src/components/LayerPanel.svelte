<script lang="ts">
  import type { LayerItem } from '../layers/types.js';
  import { getLayerName } from '../layers/types.js';

  type Props = {
    layers: LayerItem[];
    selectedLayerId: string | null;
    onLayerSelect: (layerId: string) => void;
    onLayerVisibilityChange: (layerId: string, visible: boolean) => void;
    onLayerLockChange: (layerId: string, locked: boolean) => void;
    onLayerOpacityChange: (layerId: string, opacity: number) => void;
    onCreateGroup?: (layerIds: string[]) => void;
    onDeleteGroup?: (groupId: string) => void;
    onRenameLayer?: (layerId: string, name: string) => void;
  };

  let {
    layers = [],
    selectedLayerId,
    onLayerSelect,
    onLayerVisibilityChange,
    onLayerLockChange,
    onLayerOpacityChange,
    onCreateGroup,
    onDeleteGroup,
    onRenameLayer
  } = $props();

  let expandedGroups = $state<Set<string>>(new Set());

  const sortedLayers = $derived(
    [...layers].sort((a, b) => b.order - a.order)
  );

  const toggleGroupExpanded = (groupId: string) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(groupId)) {
      newSet.delete(groupId);
    } else {
      newSet.add(groupId);
    }
    expandedGroups = newSet;
  };

  const getChildLayers = (parentId: string): LayerItem[] => {
    return layers.filter(l => l.parentId === parentId).sort((a, b) => b.order - a.order);
  };
</script>

<div class="layer-panel">
  <div class="lp-header">
    <h3 class="lp-title">Layers</h3>
    <span class="lp-count">{layers.length}</span>
    <button
      class="lp-action-btn"
      title="Create Group"
      onclick={() => onCreateGroup?.()}
      aria-label="Create group from selection"
    >
      +📁
    </button>
  </div>

  {#if layers.length === 0}
    <div class="lp-empty">
      <p>No elements yet</p>
    </div>
  {:else}
    <div class="lp-layers">
      {#each sortedLayers as layer (layer.id)}
        {#if !layer.parentId}
          <!-- Render root-level item or group -->
          {#if layer.type === 'group'}
            <div class="lp-group">
              <!-- Group Header -->
              <div
                class="lp-item lp-group-header"
                class:selected={selectedLayerId === layer.id}
                role="button"
                tabindex="0"
                onmousedown={() => onLayerSelect(layer.id)}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onLayerSelect(layer.id);
                  }
                }}
              >
                <!-- Expand/Collapse Toggle -->
                <button
                  class="lp-expand"
                  onclick={(e) => {
                    e.stopPropagation();
                    toggleGroupExpanded(layer.id);
                  }}
                  title={expandedGroups.has(layer.id) ? 'Collapse' : 'Expand'}
                >
                  {expandedGroups.has(layer.id) ? '▼' : '▶'}
                </button>

                <!-- Group Icon -->
                <span class="lp-group-icon">📁</span>

                <!-- Group Name -->
                <div class="lp-name-cell">
                  <span class="lp-name">{layer.name || 'Group'}</span>
                </div>

                <!-- Visibility Toggle -->
                <button
                  class="lp-visibility"
                  title={layer.visible ? 'Hide' : 'Show'}
                  onclick={(e) => {
                    e.stopPropagation();
                    onLayerVisibilityChange(layer.id, !layer.visible);
                  }}
                >
                  {#if layer.visible}
                    👁️
                  {:else}
                    🚫
                  {/if}
                </button>

                <!-- Lock Toggle -->
                <button
                  class="lp-lock"
                  title={layer.locked ? 'Unlock' : 'Lock'}
                  onclick={(e) => {
                    e.stopPropagation();
                    onLayerLockChange(layer.id, !layer.locked);
                  }}
                >
                  {#if layer.locked}
                    🔒
                  {:else}
                    🔓
                  {/if}
                </button>
              </div>

              <!-- Group Children -->
              {#if expandedGroups.has(layer.id)}
                <div class="lp-group-children">
                  {#each getChildLayers(layer.id) as child (child.id)}
                    <div class="lp-item lp-child" style="--depth: 1">
                      <div class="lp-depth-spacer"></div>

                      <!-- Visibility Toggle -->
                      <button
                        class="lp-visibility"
                        title={child.visible ? 'Hide' : 'Show'}
                        onclick={(e) => {
                          e.stopPropagation();
                          onLayerVisibilityChange(child.id, !child.visible);
                        }}
                      >
                        {#if child.visible}
                          👁️
                        {:else}
                          🚫
                        {/if}
                      </button>

                      <!-- Child Name -->
                      <div
                        class="lp-name-cell"
                        role="button"
                        tabindex="0"
                        class:selected={selectedLayerId === child.id}
                        onmousedown={() => onLayerSelect(child.id)}
                        onkeydown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            onLayerSelect(child.id);
                          }
                        }}
                      >
                        <span class="lp-name">{getLayerName(child)}</span>
                      </div>

                      <!-- Lock Toggle -->
                      <button
                        class="lp-lock"
                        title={child.locked ? 'Unlock' : 'Lock'}
                        onclick={(e) => {
                          e.stopPropagation();
                          onLayerLockChange(child.id, !child.locked);
                        }}
                      >
                        {#if child.locked}
                          🔒
                        {:else}
                          🔓
                        {/if}
                      </button>

                      <!-- Opacity Slider -->
                      <div class="lp-opacity">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={child.opacity}
                          onchange={(e) => onLayerOpacityChange(child.id, parseFloat(e.currentTarget.value))}
                          onmousedown={(e) => e.stopPropagation()}
                          title={`Opacity: ${Math.round(child.opacity * 100)}%`}
                        />
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {:else}
            <!-- Regular layer item -->
            <div
              class="lp-item"
              class:selected={selectedLayerId === layer.id}
              role="button"
              tabindex="0"
              onmousedown={() => onLayerSelect(layer.id)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onLayerSelect(layer.id);
                }
              }}
            >
              <!-- Visibility Toggle -->
              <button
                class="lp-visibility"
                title={layer.visible ? 'Hide' : 'Show'}
                onclick={(e) => {
                  e.stopPropagation();
                  onLayerVisibilityChange(layer.id, !layer.visible);
                }}
              >
                {#if layer.visible}
                  👁️
                {:else}
                  🚫
                {/if}
              </button>

              <!-- Layer Name -->
              <div class="lp-name-cell">
                <span class="lp-name">{getLayerName(layer)}</span>
              </div>

              <!-- Lock Toggle -->
              <button
                class="lp-lock"
                title={layer.locked ? 'Unlock' : 'Lock'}
                onclick={(e) => {
                  e.stopPropagation();
                  onLayerLockChange(layer.id, !layer.locked);
                }}
              >
                {#if layer.locked}
                  🔒
                {:else}
                  🔓
                {/if}
              </button>

              <!-- Opacity Slider -->
              <div class="lp-opacity">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={layer.opacity}
                  onchange={(e) => onLayerOpacityChange(layer.id, parseFloat(e.currentTarget.value))}
                  onmousedown={(e) => e.stopPropagation()}
                  title={`Opacity: ${Math.round(layer.opacity * 100)}%`}
                />
              </div>
            </div>
          {/if}
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .layer-panel {
    padding: 12px;
    border-right: 1px solid #e5e7ea;
    background: white;
    font-size: 12px;
    max-height: 80vh;
    overflow-y: auto;
    width: 280px;
    flex-shrink: 0;
  }

  :global(.excalidraw.theme--dark) .layer-panel {
    background: #232329;
    border-right-color: #363636;
    color: #e5e7ea;
  }

  .lp-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7ea;
  }

  :global(.excalidraw.theme--dark) .lp-header {
    border-bottom-color: #363636;
  }

  .lp-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: #333;
  }

  :global(.excalidraw.theme--dark) .lp-title {
    color: #e5e7ea;
  }

  .lp-count {
    font-size: 11px;
    padding: 2px 6px;
    background: #f0f0f0;
    color: #666;
    border-radius: 3px;
  }

  :global(.excalidraw.theme--dark) .lp-count {
    background: #2e2e36;
    color: #999;
  }

  .lp-action-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #666;
  }

  :global(.excalidraw.theme--dark) .lp-action-btn {
    color: #999;
  }

  .lp-action-btn:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  :global(.excalidraw.theme--dark) .lp-action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .lp-empty {
    padding: 20px 12px;
    text-align: center;
    color: #999;
    font-size: 12px;
  }

  .lp-layers {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .lp-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px;
    border-radius: 4px;
    background: #fafafa;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
  }

  :global(.excalidraw.theme--dark) .lp-item {
    background: #2e2e36;
  }

  .lp-item:hover {
    background: #f0f0f0;
  }

  :global(.excalidraw.theme--dark) .lp-item:hover {
    background: #363636;
  }

  .lp-item.selected {
    background: #dde4f0;
    border-left: 3px solid #6965db;
    padding-left: 5px;
  }

  :global(.excalidraw.theme--dark) .lp-item.selected {
    background: #2d3748;
    border-left-color: #7c7cff;
  }

  .lp-visibility,
  .lp-lock {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .lp-visibility:hover,
  .lp-lock:hover {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 3px;
  }

  :global(.excalidraw.theme--dark) .lp-visibility:hover,
  :global(.excalidraw.theme--dark) .lp-lock:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .lp-name-cell {
    flex: 1;
    min-width: 0;
  }

  .lp-name {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #333;
    font-size: 12px;
  }

  :global(.excalidraw.theme--dark) .lp-name {
    color: #e5e7ea;
  }

  .lp-opacity {
    width: 60px;
    flex-shrink: 0;
  }

  .lp-opacity input {
    width: 100%;
    cursor: pointer;
  }

  .lp-opacity input::-webkit-slider-thumb {
    width: 12px;
    height: 12px;
    background: #6965db;
    border-radius: 50%;
    cursor: pointer;
  }

  .lp-opacity input::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: #6965db;
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }

  .lp-group {
    margin-bottom: 4px;
  }

  .lp-group-header {
    background: #f5f5f5;
    font-weight: 500;
  }

  :global(.excalidraw.theme--dark) .lp-group-header {
    background: #363636;
  }

  .lp-expand {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    flex-shrink: 0;
    color: #666;
  }

  :global(.excalidraw.theme--dark) .lp-expand {
    color: #999;
  }

  .lp-expand:hover {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 3px;
  }

  :global(.excalidraw.theme--dark) .lp-expand:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .lp-group-icon {
    font-size: 12px;
    margin-right: 2px;
  }

  .lp-group-children {
    background: rgba(0, 0, 0, 0.02);
    border-left: 2px solid #e5e7ea;
  }

  :global(.excalidraw.theme--dark) .lp-group-children {
    background: rgba(255, 255, 255, 0.02);
    border-left-color: #363636;
  }

  .lp-child {
    padding-left: 4px;
    background: transparent;
  }

  .lp-child:hover {
    background: rgba(0, 0, 0, 0.03);
  }

  :global(.excalidraw.theme--dark) .lp-child:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .lp-depth-spacer {
    width: 16px;
    flex-shrink: 0;
  }
</style>
