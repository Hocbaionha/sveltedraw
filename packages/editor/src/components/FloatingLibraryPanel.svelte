<script lang="ts">
  // Floating bottom-left library panel — saved element groups accessible
  // as a quick-insert popover. Distinct from ShapeLibraryPanel (the
  // side-docked Phase 16 panel with categories + import/export).
  import { t } from "../state/i18n.svelte.js";

  type Item = {
    id: string;
    name: string;
    elements: readonly unknown[];
  };

  type Props = {
    items: readonly Item[];
    onInsert: (item: Item) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
  };

  let { items, onInsert, onDelete, onClose }: Props = $props();
</script>

<div class="sveltedraw-library-panel" role="region" aria-label={t("toolBar.library")}>
  <div class="lib-header">
    <strong>{t("toolBar.library")}</strong>
    <button
      type="button"
      class="lib-close"
      aria-label="Close library"
      onclick={onClose}
    >×</button>
  </div>
  {#if items.length === 0}
    <div class="lib-empty">
      {t("library.hint_emptyLibrary", undefined, "Select elements, right-click → Save to library.")}
    </div>
  {:else}
    <div class="lib-items">
      {#each items as item (item.id)}
        <div class="lib-item">
          <button
            type="button"
            class="lib-item-insert"
            title={`Insert ${item.name}`}
            onclick={() => onInsert(item)}
          >
            <span class="lib-item-name">{item.name}</span>
            <span class="lib-item-count">{item.elements.length}</span>
          </button>
          <button
            type="button"
            class="lib-item-del"
            aria-label={`Delete ${item.name}`}
            title="Remove from library"
            onclick={() => onDelete(item.id)}
          >×</button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sveltedraw-library-panel {
    position: absolute;
    bottom: 16px;
    left: 16px;
    width: 260px;
    max-height: 60vh;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    z-index: 40;
    font-size: 13px;
  }
  :global(.sveltedraw.theme--dark) .sveltedraw-library-panel {
    background: #232329;
    border-color: #363636;
    color: #e5e7ea;
  }
  .lib-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid #e5e7ea;
  }
  :global(.sveltedraw.theme--dark) .lib-header {
    border-bottom-color: #363636;
  }
  .lib-close {
    background: transparent;
    border: none;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    color: inherit;
    padding: 0 4px;
  }
  .lib-empty {
    padding: 16px 12px;
    color: #6b7280;
    font-size: 12px;
  }
  .lib-items {
    overflow-y: auto;
    padding: 4px;
  }
  .lib-item {
    display: flex;
    align-items: stretch;
    gap: 2px;
    margin-bottom: 2px;
  }
  .lib-item-insert {
    flex: 1;
    text-align: left;
    padding: 6px 10px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    color: inherit;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .lib-item-insert:hover {
    background: #f1f3f5;
  }
  :global(.sveltedraw.theme--dark) .lib-item-insert:hover {
    background: #2e2e36;
  }
  .lib-item-name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lib-item-count {
    color: #9ca3af;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    margin-left: 8px;
  }
  .lib-item-del {
    width: 26px;
    background: transparent;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
  }
  .lib-item-del:hover {
    color: #e03131;
    background: #fff5f5;
    border-radius: 4px;
  }
</style>
