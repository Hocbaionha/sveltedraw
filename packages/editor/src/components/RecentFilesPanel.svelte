<script lang="ts">
  interface RecentFile {
    id: string;
    name: string;
    timestamp: number;
  }

  interface Props {
    files: RecentFile[];
    onClose: () => void;
    onDelete: (id: string) => void;
  }

  let { files, onClose, onDelete }: Props = $props();

  const formatTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
</script>

<div
  class="recent-files-backdrop"
  role="presentation"
  onclick={handleBackdropClick}
>
  <div
    class="recent-files-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="rf-title"
  >
    <div class="rf-header">
      <h2 id="rf-title">Recent Files</h2>
      <button
        type="button"
        class="rf-close"
        aria-label="Close"
        onclick={onClose}
      >×</button>
    </div>

    <div class="rf-content">
      {#if files.length === 0}
        <p class="rf-empty">No recent files</p>
      {:else}
        <div class="rf-list">
          {#each files as file (file.id)}
            <div class="rf-item">
              <div class="rf-item-info">
                <p class="rf-item-name">{file.name}</p>
                <p class="rf-item-time">{formatTime(file.timestamp)}</p>
              </div>
              <button
                type="button"
                class="rf-item-delete"
                aria-label={`Delete ${file.name}`}
                title="Delete"
                onclick={() => onDelete(file.id)}
              >
                ✕
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .recent-files-backdrop {
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

  .recent-files-modal {
    background: white;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    max-width: 400px;
    width: 90%;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
  }

  :global(.sveltedraw.theme--dark) .recent-files-modal {
    background: #232329;
    color: #e5e7ea;
  }

  .rf-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #e5e7ea;
  }

  :global(.sveltedraw.theme--dark) .rf-header {
    border-bottom-color: #363636;
  }

  .rf-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .rf-close {
    background: transparent;
    border: none;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    color: inherit;
    padding: 0 8px;
  }

  .rf-content {
    flex: 1;
    overflow-y: auto;
  }

  .rf-empty {
    text-align: center;
    color: #999;
    padding: 40px 20px;
    margin: 0;
  }

  .rf-list {
    display: flex;
    flex-direction: column;
    padding: 8px;
  }

  .rf-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .rf-item:hover {
    background: #f5f5f5;
  }

  :global(.sveltedraw.theme--dark) .rf-item:hover {
    background: #2e2e36;
  }

  .rf-item-info {
    flex: 1;
    min-width: 0;
  }

  .rf-item-name {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rf-item-time {
    margin: 0;
    font-size: 12px;
    color: #999;
  }

  :global(.sveltedraw.theme--dark) .rf-item-time {
    color: #666;
  }

  .rf-item-delete {
    flex-shrink: 0;
    background: transparent;
    border: none;
    color: #999;
    cursor: pointer;
    font-size: 16px;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .rf-item-delete:hover {
    color: #e03131;
    background: #fff5f5;
  }

  :global(.sveltedraw.theme--dark) .rf-item-delete:hover {
    background: #3d1515;
  }
</style>
