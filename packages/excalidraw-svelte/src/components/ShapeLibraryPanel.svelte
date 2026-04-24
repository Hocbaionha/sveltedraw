<script lang="ts">
  import type { LibraryComponent, LibraryCategory } from '../library/types.js';
  import { getCategoryLabel, filterComponentsByCategory, searchComponents } from '../library/types.js';

  type Props = {
    components: LibraryComponent[];
    categories: LibraryCategory[];
    selectedCategoryId: string;
    searchQuery: string;
    onSelectComponent: (component: LibraryComponent) => void;
    onDeleteComponent: (componentId: string) => void;
    onCategoryChange: (categoryId: string) => void;
    onSearchChange: (query: string) => void;
    onExportLibrary: () => void;
    onImportLibrary: () => void;
  };

  let {
    components = [],
    categories = [],
    selectedCategoryId = 'all',
    searchQuery = '',
    onSelectComponent,
    onDeleteComponent,
    onCategoryChange,
    onSearchChange,
    onExportLibrary,
    onImportLibrary,
  }: Props = $props();

  let filteredComponents = $derived.by(() => {
    let result = filterComponentsByCategory(components, selectedCategoryId);
    result = searchComponents(result, searchQuery);
    return result;
  });

  const handleDragStart = (component: LibraryComponent, event: DragEvent) => {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/json', JSON.stringify(component));
      event.dataTransfer.setData('text/plain', component.name);
    }
  };
</script>

<div class="library-panel">
  <!-- Header -->
  <div class="lp-header">
    <h3 class="lp-title">Shape Library</h3>
    <span class="lp-count">{components.length}</span>
  </div>

  <!-- Search bar -->
  <div class="lp-search">
    <input
      type="text"
      class="lp-search-input"
      placeholder="Search components..."
      value={searchQuery}
      onchange={(e) => onSearchChange((e.target as HTMLInputElement).value)}
    />
  </div>

  <!-- Category tabs -->
  <div class="lp-categories">
    <button
      class="lp-cat-btn"
      class:active={selectedCategoryId === 'all'}
      onclick={() => onCategoryChange('all')}
      title="All components"
    >
      All
    </button>
    {#each categories as category (category.id)}
      <button
        class="lp-cat-btn"
        class:active={selectedCategoryId === category.id}
        onclick={() => onCategoryChange(category.id)}
        title={category.name}
      >
        <span class="lp-cat-icon">{category.icon}</span>
        <span class="lp-cat-name">{category.name}</span>
      </button>
    {/each}
  </div>

  <!-- Components list -->
  <div class="lp-components">
    {#if filteredComponents.length === 0}
      <div class="lp-empty">
        <p>
          {components.length === 0 ? 'No components yet' : 'No results'}
        </p>
      </div>
    {:else}
      {#each filteredComponents as component (component.id)}
        <div
          class="lp-component"
          draggable="true"
          ondragstart={(e) => handleDragStart(component, e)}
          title={component.description || component.name}
        >
          <!-- Thumbnail preview -->
          {#if component.thumbnail}
            <div class="lp-comp-thumb">
              <img src={component.thumbnail} alt={component.name} />
            </div>
          {:else}
            <div class="lp-comp-placeholder">
              <span>📦</span>
            </div>
          {/if}

          <!-- Component info -->
          <div class="lp-comp-info">
            <div class="lp-comp-name">{component.name}</div>
            <div class="lp-comp-meta">
              {component.elements.length} element{component.elements.length !== 1 ? 's' : ''}
              · {component.usage}× used
            </div>
            {#if component.tags.length > 0}
              <div class="lp-comp-tags">
                {#each component.tags.slice(0, 2) as tag}
                  <span class="lp-tag">{tag}</span>
                {/each}
                {#if component.tags.length > 2}
                  <span class="lp-tag">+{component.tags.length - 2}</span>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Actions -->
          <div class="lp-comp-actions">
            <button
              class="lp-action-btn"
              aria-label="Use component"
              title="Drag to canvas or click to insert"
              onclick={() => onSelectComponent(component)}
            >
              ➕
            </button>
            <button
              class="lp-action-btn lp-delete-btn"
              aria-label="Delete component"
              title="Delete from library"
              onclick={() => onDeleteComponent(component.id)}
            >
              🗑️
            </button>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Footer actions -->
  <div class="lp-footer">
    <button
      class="lp-footer-btn"
      aria-label="Export library"
      title="Export library as JSON"
      onclick={onExportLibrary}
    >
      ⬇️ Export
    </button>
    <button
      class="lp-footer-btn"
      aria-label="Import library"
      title="Import library from JSON"
      onclick={onImportLibrary}
    >
      ⬆️ Import
    </button>
  </div>
</div>

<style>
  .library-panel {
    padding: 12px;
    border-right: 1px solid #e5e7ea;
    background: white;
    font-size: 12px;
    max-height: 80vh;
    overflow-y: auto;
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
  }

  :global(.excalidraw.theme--dark) .library-panel {
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

  .lp-search {
    margin-bottom: 8px;
  }

  .lp-search-input {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #d1d4da;
    border-radius: 4px;
    font-size: 11px;
    box-sizing: border-box;
  }

  :global(.excalidraw.theme--dark) .lp-search-input {
    background: #2e2e36;
    border-color: #363636;
    color: #e5e7ea;
  }

  .lp-search-input::placeholder {
    color: #999;
  }

  :global(.excalidraw.theme--dark) .lp-search-input::placeholder {
    color: #666;
  }

  .lp-categories {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
    overflow-x: auto;
    padding-bottom: 6px;
  }

  .lp-cat-btn {
    flex-shrink: 0;
    padding: 4px 8px;
    background: #f0f0f0;
    border: 1px solid #d1d4da;
    border-radius: 3px;
    cursor: pointer;
    font-size: 10px;
    color: #666;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  :global(.excalidraw.theme--dark) .lp-cat-btn {
    background: #2e2e36;
    border-color: #363636;
    color: #999;
  }

  .lp-cat-btn:hover {
    background: #e5e7ea;
  }

  :global(.excalidraw.theme--dark) .lp-cat-btn:hover {
    background: #363636;
  }

  .lp-cat-btn.active {
    background: #6965db;
    color: white;
    border-color: #6965db;
  }

  :global(.excalidraw.theme--dark) .lp-cat-btn.active {
    background: #7c7cff;
    border-color: #7c7cff;
  }

  .lp-cat-icon {
    font-size: 12px;
  }

  .lp-cat-name {
    font-weight: 500;
  }

  .lp-components {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 8px;
  }

  .lp-empty {
    padding: 20px 12px;
    text-align: center;
    color: #999;
    font-size: 11px;
  }

  .lp-component {
    display: flex;
    gap: 8px;
    padding: 8px;
    border-radius: 4px;
    background: #fafafa;
    cursor: grab;
    transition: all 0.15s;
    user-select: none;
    border: 1px solid transparent;
  }

  .lp-component:active {
    cursor: grabbing;
  }

  :global(.excalidraw.theme--dark) .lp-component {
    background: #2e2e36;
  }

  .lp-component:hover {
    background: #f0f0f0;
    border-color: #d1d4da;
  }

  :global(.excalidraw.theme--dark) .lp-component:hover {
    background: #363636;
    border-color: #4a4a52;
  }

  .lp-comp-thumb,
  .lp-comp-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 3px;
    background: #e5e7ea;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  :global(.excalidraw.theme--dark) .lp-comp-thumb,
  :global(.excalidraw.theme--dark) .lp-comp-placeholder {
    background: #1a1a1a;
  }

  .lp-comp-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .lp-comp-placeholder span {
    font-size: 24px;
  }

  .lp-comp-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .lp-comp-name {
    font-size: 11px;
    font-weight: 500;
    color: #333;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.excalidraw.theme--dark) .lp-comp-name {
    color: #e5e7ea;
  }

  .lp-comp-meta {
    font-size: 10px;
    color: #999;
  }

  :global(.excalidraw.theme--dark) .lp-comp-meta {
    color: #666;
  }

  .lp-comp-tags {
    display: flex;
    gap: 2px;
    flex-wrap: wrap;
  }

  .lp-tag {
    display: inline-block;
    font-size: 9px;
    padding: 2px 4px;
    background: #e0e0ff;
    color: #6965db;
    border-radius: 2px;
  }

  :global(.excalidraw.theme--dark) .lp-tag {
    background: #3a3a4a;
    color: #7c7cff;
  }

  .lp-comp-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .lp-action-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: 1px solid transparent;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .lp-action-btn:hover {
    background: rgba(0, 0, 0, 0.1);
    border-color: #d1d4da;
  }

  :global(.excalidraw.theme--dark) .lp-action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: #4a4a52;
  }

  .lp-delete-btn:hover {
    background: rgba(255, 0, 0, 0.1);
    border-color: #ff6b6b;
  }

  .lp-footer {
    display: flex;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid #e5e7ea;
  }

  :global(.excalidraw.theme--dark) .lp-footer {
    border-top-color: #363636;
  }

  .lp-footer-btn {
    flex: 1;
    padding: 6px 8px;
    background: #f0f0f0;
    border: 1px solid #d1d4da;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
    color: #333;
    transition: all 0.15s;
  }

  :global(.excalidraw.theme--dark) .lp-footer-btn {
    background: #2e2e36;
    border-color: #363636;
    color: #e5e7ea;
  }

  .lp-footer-btn:hover {
    background: #e5e7ea;
  }

  :global(.excalidraw.theme--dark) .lp-footer-btn:hover {
    background: #363636;
  }
</style>
