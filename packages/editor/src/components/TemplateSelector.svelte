<script lang="ts">
  import type { Template } from '../templates/index.js';
  import { getTemplates } from '../templates/index.js';

  interface Props {
    onSelect: (template: Template) => void;
    onClose: () => void;
  }

  let { onSelect, onClose }: Props = $props();

  const templates = getTemplates();

  const handleSelect = (template: Template) => {
    onSelect(template);
    onClose();
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
</script>

<div
  class="template-selector-backdrop"
  role="presentation"
  onclick={handleBackdropClick}
>
  <div
    class="template-selector-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="ts-title"
  >
    <div class="ts-header">
      <h2 id="ts-title">Choose a Template</h2>
      <button
        type="button"
        class="ts-close"
        aria-label="Close"
        onclick={onClose}
      >×</button>
    </div>

    <div class="ts-content">
      {#if templates.length === 0}
        <p class="ts-empty">No templates available</p>
      {:else}
        <div class="ts-grid">
          {#each templates as template (template.name)}
            <div class="ts-card">
              <div class="ts-card-preview">
                <div class="ts-icon">📋</div>
              </div>
              <h3 class="ts-card-name">{template.name}</h3>
              <p class="ts-card-desc">{template.description}</p>
              <button
                type="button"
                class="ts-card-btn"
                onclick={() => handleSelect(template)}
              >
                Use Template
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .template-selector-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .template-selector-modal {
    background: white;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    max-width: 700px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  :global(.sveltedraw.theme--dark) .template-selector-modal {
    background: #232329;
    color: #e5e7ea;
  }

  .ts-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    border-bottom: 1px solid #e5e7ea;
  }

  :global(.sveltedraw.theme--dark) .ts-header {
    border-bottom-color: #363636;
  }

  .ts-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .ts-close {
    background: transparent;
    border: none;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    color: inherit;
    padding: 0 8px;
  }

  .ts-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .ts-empty {
    text-align: center;
    color: #999;
    padding: 40px 20px;
  }

  .ts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
  }

  .ts-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border: 1px solid #e5e7ea;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  :global(.sveltedraw.theme--dark) .ts-card {
    border-color: #363636;
  }

  .ts-card:hover {
    border-color: #6965db;
    background: #f9f9fb;
    box-shadow: 0 2px 8px rgba(105, 101, 219, 0.1);
  }

  :global(.sveltedraw.theme--dark) .ts-card:hover {
    background: #2e2e36;
  }

  .ts-card-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 80px;
    background: #f5f5f5;
    border-radius: 4px;
  }

  :global(.sveltedraw.theme--dark) .ts-card-preview {
    background: #1a1a1f;
  }

  .ts-icon {
    font-size: 32px;
  }

  .ts-card-name {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .ts-card-desc {
    margin: 0;
    font-size: 12px;
    color: #666;
    line-height: 1.4;
  }

  :global(.sveltedraw.theme--dark) .ts-card-desc {
    color: #aaa;
  }

  .ts-card-btn {
    padding: 8px 12px;
    background: #6965db;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .ts-card-btn:hover {
    background: #5654c5;
  }

  .ts-card-btn:active {
    background: #4543b5;
  }
</style>
