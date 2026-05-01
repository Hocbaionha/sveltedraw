<script lang="ts">
  interface Settings {
    theme: "light" | "dark" | "auto";
    gridVisible: boolean;
    gridSize: number;
    snapToGrid: boolean;
    autoSaveInterval: number;
    undoHistorySize: number;
  }

  interface Props {
    settings: Settings;
    onSettingsChange: (settings: Settings) => void;
    onClose: () => void;
  }

  let { settings, onSettingsChange, onClose }: Props = $props();
  // localSettings is a one-shot copy of the prop at mount: the panel
  // owns the editing buffer and only commits via Save. Subsequent
  // prop changes from the parent are intentionally ignored
  // (Svelte's expected behavior for prop-as-default seed).
  // svelte-ignore state_referenced_locally
  let localSettings = $state({ ...settings });

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
</script>

<div
  class="settings-backdrop"
  role="presentation"
  onclick={handleBackdropClick}
>
  <div
    class="settings-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
  >
    <div class="settings-header">
      <h2 id="settings-title">Settings</h2>
      <button
        type="button"
        class="settings-close"
        aria-label="Close"
        onclick={onClose}
      >×</button>
    </div>

    <div class="settings-content">
      <!-- Display Settings -->
      <div class="settings-section">
        <h3>Display</h3>

        <div class="settings-group">
          <label for="theme-select" class="settings-label">Theme:</label>
          <select
            id="theme-select"
            class="settings-input"
            bind:value={localSettings.theme}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </div>

        <div class="settings-group">
          <label for="grid-visible" class="settings-label">
            <input
              id="grid-visible"
              type="checkbox"
              bind:checked={localSettings.gridVisible}
            />
            Show grid
          </label>
        </div>

        <div class="settings-group">
          <label for="grid-size" class="settings-label">Grid size (px):</label>
          <input
            id="grid-size"
            type="range"
            class="settings-input settings-range"
            min="5"
            max="50"
            bind:value={localSettings.gridSize}
          />
          <span class="settings-value">{localSettings.gridSize}</span>
        </div>

        <div class="settings-group">
          <label for="snap-grid" class="settings-label">
            <input
              id="snap-grid"
              type="checkbox"
              bind:checked={localSettings.snapToGrid}
            />
            Snap to grid
          </label>
        </div>
      </div>

      <!-- Editor Settings -->
      <div class="settings-section">
        <h3>Editor</h3>

        <div class="settings-group">
          <label for="auto-save" class="settings-label"
            >Auto-save interval (seconds):</label
          >
          <input
            id="auto-save"
            type="range"
            class="settings-input settings-range"
            min="5"
            max="60"
            step="5"
            bind:value={localSettings.autoSaveInterval}
          />
          <span class="settings-value">{localSettings.autoSaveInterval}s</span>
        </div>

        <div class="settings-group">
          <label for="undo-size" class="settings-label"
            >Undo history size:</label
          >
          <input
            id="undo-size"
            type="range"
            class="settings-input settings-range"
            min="50"
            max="500"
            step="50"
            bind:value={localSettings.undoHistorySize}
          />
          <span class="settings-value">{localSettings.undoHistorySize}</span>
        </div>
      </div>
    </div>

    <div class="settings-footer">
      <button
        type="button"
        class="settings-btn settings-btn--secondary"
        onclick={onClose}
      >
        Cancel
      </button>
      <button
        type="button"
        class="settings-btn settings-btn--primary"
        onclick={handleSave}
      >
        Save Settings
      </button>
    </div>
  </div>
</div>

<style>
  .settings-backdrop {
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

  .settings-modal {
    background: white;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  :global(.sveltedraw.theme--dark) .settings-modal {
    background: #232329;
    color: #e5e7ea;
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    border-bottom: 1px solid #e5e7ea;
  }

  :global(.sveltedraw.theme--dark) .settings-header {
    border-bottom-color: #363636;
  }

  .settings-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .settings-close {
    background: transparent;
    border: none;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    color: inherit;
    padding: 0 8px;
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .settings-section {
    margin-bottom: 24px;
  }

  .settings-section:last-child {
    margin-bottom: 0;
  }

  .settings-section h3 {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    color: #999;
  }

  :global(.sveltedraw.theme--dark) .settings-section h3 {
    color: #666;
  }

  .settings-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .settings-label {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    cursor: pointer;
  }

  .settings-input {
    padding: 8px;
    border: 1px solid #d1d4da;
    border-radius: 4px;
    background: white;
    color: inherit;
    font-size: 13px;
  }

  :global(.sveltedraw.theme--dark) .settings-input {
    background: #2e2e36;
    border-color: #363636;
  }

  .settings-range {
    flex: 1;
    max-width: 150px;
  }

  .settings-value {
    font-size: 13px;
    color: #666;
    min-width: 50px;
    text-align: right;
  }

  :global(.sveltedraw.theme--dark) .settings-value {
    color: #999;
  }

  .settings-footer {
    display: flex;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid #e5e7ea;
    justify-content: flex-end;
  }

  :global(.sveltedraw.theme--dark) .settings-footer {
    border-top-color: #363636;
  }

  .settings-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .settings-btn--primary {
    background: #6965db;
    color: white;
  }

  .settings-btn--primary:hover {
    background: #5654c5;
  }

  .settings-btn--primary:active {
    background: #4543b5;
  }

  .settings-btn--secondary {
    background: transparent;
    border: 1px solid #d1d4da;
    color: inherit;
  }

  :global(.sveltedraw.theme--dark) .settings-btn--secondary {
    border-color: #363636;
  }

  .settings-btn--secondary:hover {
    background: #f5f5f5;
  }

  :global(.sveltedraw.theme--dark) .settings-btn--secondary:hover {
    background: #2e2e36;
  }
</style>
