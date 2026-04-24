<script lang="ts">
  import type { HistoryState } from '../history/types.js';
  import { formatHistoryTime } from '../history/types.js';

  type Props = {
    history: HistoryState[];
    currentIndex: number;
    onJumpToState: (index: number) => void;
    onClearHistory?: () => void;
  };

  let { history = [], currentIndex, onJumpToState, onClearHistory }: Props = $props();

  const isCurrentState = (index: number) => index === currentIndex;
</script>

<div class="history-panel">
  <div class="hp-header">
    <h3 class="hp-title">History</h3>
    <span class="hp-count">{history.length}</span>
    <button
      class="hp-action-btn"
      title="Clear history"
      onclick={() => onClearHistory?.()}
      aria-label="Clear history"
    >
      🗑️
    </button>
  </div>

  {#if history.length === 0}
    <div class="hp-empty">
      <p>No history yet</p>
    </div>
  {:else}
    <div class="hp-timeline">
      <!-- Timeline visualization -->
      <div class="hp-timeline-track">
        {#each history as state, index (state.id)}
          <div
            class="hp-timeline-dot"
            class:current={isCurrentState(index)}
            class:past={index < currentIndex}
            class:future={index > currentIndex}
            role="button"
            tabindex="0"
            title={state.description}
            onclick={() => onJumpToState(index)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onJumpToState(index);
              }
            }}
          >
            <div class="hp-dot-inner"></div>
          </div>
        {/each}
      </div>

      <!-- History list -->
      <div class="hp-list">
        {#each history as state, index (state.id)}
          <div
            class="hp-item"
            class:current={isCurrentState(index)}
            class:past={index < currentIndex}
            class:future={index > currentIndex}
            role="button"
            tabindex="0"
            onclick={() => onJumpToState(index)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onJumpToState(index);
              }
            }}
          >
            <!-- Item indicator -->
            <div class="hp-item-indicator">
              {#if isCurrentState(index)}
                ●
              {:else if index < currentIndex}
                ○
              {:else}
                ◌
              {/if}
            </div>

            <!-- Item content -->
            <div class="hp-item-content">
              <div class="hp-item-desc">{state.description}</div>
              <div class="hp-item-meta">
                {state.elementCount} element{state.elementCount !== 1 ? 's' : ''}
                · {formatHistoryTime(state.timestamp)}
              </div>
            </div>

            <!-- Preview thumbnail -->
            {#if state.previewDataUrl}
              <div class="hp-item-preview">
                <img src={state.previewDataUrl} alt="State preview" />
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .history-panel {
    padding: 12px;
    border-right: 1px solid #e5e7ea;
    background: white;
    font-size: 12px;
    max-height: 80vh;
    overflow-y: auto;
    width: 280px;
    flex-shrink: 0;
  }

  :global(.excalidraw.theme--dark) .history-panel {
    background: #232329;
    border-right-color: #363636;
    color: #e5e7ea;
  }

  .hp-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7ea;
  }

  :global(.excalidraw.theme--dark) .hp-header {
    border-bottom-color: #363636;
  }

  .hp-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: #333;
  }

  :global(.excalidraw.theme--dark) .hp-title {
    color: #e5e7ea;
  }

  .hp-count {
    font-size: 11px;
    padding: 2px 6px;
    background: #f0f0f0;
    color: #666;
    border-radius: 3px;
  }

  :global(.excalidraw.theme--dark) .hp-count {
    background: #2e2e36;
    color: #999;
  }

  .hp-action-btn {
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
  }

  .hp-action-btn:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  :global(.excalidraw.theme--dark) .hp-action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .hp-empty {
    padding: 20px 12px;
    text-align: center;
    color: #999;
    font-size: 12px;
  }

  .hp-timeline {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .hp-timeline-track {
    display: flex;
    gap: 8px;
    padding: 8px 0;
    overflow-x: auto;
    min-height: 32px;
    align-items: center;
  }

  .hp-timeline-dot {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    background: #f0f0f0;
  }

  :global(.excalidraw.theme--dark) .hp-timeline-dot {
    background: #2e2e36;
  }

  .hp-timeline-dot:hover {
    transform: scale(1.2);
    background: #e5e7ea;
  }

  :global(.excalidraw.theme--dark) .hp-timeline-dot:hover {
    background: #363636;
  }

  .hp-timeline-dot.current {
    background: #6965db;
    box-shadow: 0 0 0 3px rgba(105, 101, 219, 0.2);
  }

  :global(.excalidraw.theme--dark) .hp-timeline-dot.current {
    background: #7c7cff;
    box-shadow: 0 0 0 3px rgba(124, 124, 255, 0.2);
  }

  .hp-timeline-dot.past {
    opacity: 0.6;
  }

  .hp-timeline-dot.future {
    opacity: 0.3;
  }

  .hp-dot-inner {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: white;
  }

  .hp-timeline-dot.current .hp-dot-inner {
    background: white;
  }

  :global(.excalidraw.theme--dark) .hp-timeline-dot.current .hp-dot-inner {
    background: #232329;
  }

  .hp-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .hp-item {
    display: flex;
    gap: 8px;
    padding: 8px;
    border-radius: 4px;
    background: #fafafa;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
  }

  :global(.excalidraw.theme--dark) .hp-item {
    background: #2e2e36;
  }

  .hp-item:hover {
    background: #f0f0f0;
  }

  :global(.excalidraw.theme--dark) .hp-item:hover {
    background: #363636;
  }

  .hp-item.current {
    background: #dde4f0;
    border-left: 3px solid #6965db;
    padding-left: 5px;
  }

  :global(.excalidraw.theme--dark) .hp-item.current {
    background: #2d3748;
    border-left-color: #7c7cff;
  }

  .hp-item.past {
    opacity: 0.7;
  }

  .hp-item.future {
    opacity: 0.4;
  }

  .hp-item-indicator {
    font-size: 10px;
    color: #666;
    min-width: 12px;
    text-align: center;
  }

  :global(.excalidraw.theme--dark) .hp-item-indicator {
    color: #999;
  }

  .hp-item.current .hp-item-indicator {
    color: #6965db;
    font-weight: bold;
  }

  :global(.excalidraw.theme--dark) .hp-item.current .hp-item-indicator {
    color: #7c7cff;
  }

  .hp-item-content {
    flex: 1;
    min-width: 0;
  }

  .hp-item-desc {
    font-size: 11px;
    font-weight: 500;
    color: #333;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.excalidraw.theme--dark) .hp-item-desc {
    color: #e5e7ea;
  }

  .hp-item-meta {
    font-size: 10px;
    color: #999;
    margin-top: 2px;
  }

  :global(.excalidraw.theme--dark) .hp-item-meta {
    color: #666;
  }

  .hp-item-preview {
    width: 40px;
    height: 40px;
    border-radius: 2px;
    overflow: hidden;
    background: #e5e7ea;
    flex-shrink: 0;
  }

  :global(.excalidraw.theme--dark) .hp-item-preview {
    background: #1a1a1a;
  }

  .hp-item-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
