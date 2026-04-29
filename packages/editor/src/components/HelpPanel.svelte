<script lang="ts">
  type HelpTab = "getting-started" | "shortcuts" | "features";

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();
  let activeTab = $state<HelpTab>("getting-started");

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };
</script>

<div
  class="help-backdrop"
  role="presentation"
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
>
  <div
    class="help-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="help-title"
  >
    <div class="help-header">
      <h2 id="help-title">Help & Documentation</h2>
      <button
        type="button"
        class="help-close"
        aria-label="Close"
        onclick={onClose}
      >×</button>
    </div>

    <div class="help-tabs">
      <button
        type="button"
        class="help-tab"
        class:active={activeTab === "getting-started"}
        onclick={() => (activeTab = "getting-started")}
      >
        Getting Started
      </button>
      <button
        type="button"
        class="help-tab"
        class:active={activeTab === "shortcuts"}
        onclick={() => (activeTab = "shortcuts")}
      >
        Keyboard Shortcuts
      </button>
      <button
        type="button"
        class="help-tab"
        class:active={activeTab === "features"}
        onclick={() => (activeTab = "features")}
      >
        Features
      </button>
    </div>

    <div class="help-content">
      {#if activeTab === "getting-started"}
        <div class="help-section">
          <h3>Welcome to Sveltedraw</h3>
          <p>
            Sveltedraw is a powerful drawing application built with Svelte.
            Here's how to get started:
          </p>

          <h4>Drawing Your First Shape</h4>
          <ol>
            <li>Click on a tool (Rectangle, Circle, Line, etc.)</li>
            <li>Click and drag on the canvas to draw</li>
            <li>Release to create the shape</li>
            <li>Use the style panel to change colors and properties</li>
          </ol>

          <h4>Selecting and Moving</h4>
          <ol>
            <li>Click the Selection tool (pointer icon) or press V</li>
            <li>Click on a shape to select it</li>
            <li>Drag to move it around</li>
            <li>Hold Shift and click to select multiple shapes</li>
          </ol>

          <h4>Organizing Your Work</h4>
          <ul>
            <li>Use Groups (Ctrl+G) to organize related shapes</li>
            <li>Use Frames (Ctrl+Shift+F) to create pages</li>
            <li>Use Undo/Redo (Ctrl+Z / Ctrl+Y) to fix mistakes</li>
          </ul>

          <h4>Saving Your Work</h4>
          <ul>
            <li>Your drawing is automatically saved to browser storage</li>
            <li>Use Ctrl+S to export as PNG</li>
            <li>Use Ctrl+Shift+S to export as SVG</li>
          </ul>
        </div>
      {:else if activeTab === "shortcuts"}
        <div class="help-section">
          <h3>Essential Keyboard Shortcuts</h3>

          <h4>Tools (Press number or letter)</h4>
          <div class="shortcuts-table">
            <div class="shortcut-row">
              <span class="shortcut-key">V / 1</span>
              <span>Selection tool</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-key">R / 2</span>
              <span>Rectangle</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-key">D / 3</span>
              <span>Diamond</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-key">O / 4</span>
              <span>Ellipse</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-key">A / 5</span>
              <span>Arrow</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-key">L / 6</span>
              <span>Line</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-key">P / 7</span>
              <span>Freedraw</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-key">T / 8</span>
              <span>Text</span>
            </div>
          </div>

          <h4>Editing</h4>
          <div class="shortcuts-table">
            <div class="shortcut-row">
              <span class="shortcut-key">Ctrl+Z</span>
              <span>Undo</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-key">Ctrl+Y</span>
              <span>Redo</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-key">Ctrl+A</span>
              <span>Select all</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-key">Ctrl+D</span>
              <span>Duplicate</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-key">Ctrl+G</span>
              <span>Group</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-key">Ctrl+Shift+G</span>
              <span>Ungroup</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-key">Delete</span>
              <span>Delete selected</span>
            </div>
          </div>

          <h4>Phase 12 Features</h4>
          <div class="shortcuts-table">
            <div class="shortcut-row">
              <span class="shortcut-key">Ctrl+N</span>
              <span>New from template</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-key">Ctrl+R</span>
              <span>Recent files</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-key">Ctrl+,</span>
              <span>Settings</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-key">Ctrl+L</span>
              <span>Toggle library</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-key">Ctrl+Shift+F</span>
              <span>New frame</span>
            </div>
          </div>
        </div>
      {:else if activeTab === "features"}
        <div class="help-section">
          <h3>Sveltedraw Features</h3>

          <h4>Drawing Tools</h4>
          <p>
            Choose from 8 drawing tools: Rectangle, Ellipse, Diamond, Line,
            Arrow, Text, Freedraw, and Image. Each tool can be customized with
            colors, stroke width, and more.
          </p>

          <h4>Styling</h4>
          <p>
            Customize elements with a full styling system: stroke colors, fill
            colors, stroke styles (solid/dashed/dotted), font families, font
            sizes, and text alignment.
          </p>

          <h4>Organization</h4>
          <p>
            Keep your drawings organized with Groups and Frames. Groups let you
            move multiple shapes together, while Frames help you create
            multi-page documents.
          </p>

          <h4>Templates (Phase 12)</h4>
          <p>
            Start quickly with pre-made templates: Flowchart, Wireframe,
            Organization Chart, Mind Map, and Kanban Board. Press Ctrl+N to
            browse templates.
          </p>

          <h4>Library (Phase 12)</h4>
          <p>
            Save your favorite element groups to the library for quick reuse.
            Right-click and select "Save to library" or press Ctrl+L to toggle
            the library panel.
          </p>

          <h4>Recent Files (Phase 12)</h4>
          <p>
            Automatically tracks your last 10 drawings for easy access. Press
            Ctrl+R to view recent files.
          </p>

          <h4>Export</h4>
          <p>
            Export your drawings as PNG, SVG, or JSON. Press Ctrl+S for PNG or
            Ctrl+Shift+S for SVG.
          </p>

          <h4>Undo/Redo</h4>
          <p>
            Unlimited undo and redo with 500 history entries. Press Ctrl+Z to
            undo or Ctrl+Y to redo.
          </p>

          <h4>Dark Mode</h4>
          <p>
            Easy on the eyes with full dark mode support. Toggle in the top
            toolbar or use settings.
          </p>

          <h4>Multi-Language</h4>
          <p>
            Sveltedraw supports 30+ languages. Switch languages in the toolbar
            or settings.
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .help-backdrop {
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

  .help-modal {
    background: white;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    max-width: 700px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  :global(.sveltedraw.theme--dark) .help-modal {
    background: #232329;
    color: #e5e7ea;
  }

  .help-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    border-bottom: 1px solid #e5e7ea;
  }

  :global(.sveltedraw.theme--dark) .help-header {
    border-bottom-color: #363636;
  }

  .help-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .help-close {
    background: transparent;
    border: none;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    color: inherit;
    padding: 0 8px;
  }

  .help-tabs {
    display: flex;
    gap: 8px;
    padding: 12px 20px;
    border-bottom: 1px solid #e5e7ea;
    background: #f5f5f5;
  }

  :global(.sveltedraw.theme--dark) .help-tabs {
    background: #1a1a1f;
    border-bottom-color: #363636;
  }

  .help-tab {
    padding: 8px 16px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .help-tab:hover {
    background: #e5e5e5;
  }

  :global(.sveltedraw.theme--dark) .help-tab:hover {
    background: #2e2e36;
  }

  .help-tab.active {
    background: white;
    color: #6965db;
  }

  :global(.sveltedraw.theme--dark) .help-tab.active {
    background: #232329;
  }

  .help-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .help-section h3 {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 600;
  }

  .help-section h4 {
    margin: 16px 0 8px;
    font-size: 14px;
    font-weight: 600;
  }

  .help-section p {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.6;
    color: #666;
  }

  :global(.sveltedraw.theme--dark) .help-section p {
    color: #aaa;
  }

  .help-section ul,
  .help-section ol {
    margin: 0 0 12px;
    padding-left: 20px;
    font-size: 13px;
    line-height: 1.6;
  }

  .help-section li {
    margin-bottom: 4px;
  }

  .shortcuts-table {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
  }

  .shortcut-row {
    display: flex;
    gap: 12px;
    padding: 8px;
    border-radius: 4px;
    background: #f5f5f5;
    font-size: 13px;
  }

  :global(.sveltedraw.theme--dark) .shortcut-row {
    background: #2e2e36;
  }

  .shortcut-key {
    font-weight: 600;
    color: #6965db;
    min-width: 100px;
  }

  :global(.sveltedraw.theme--dark) .shortcut-key {
    color: #8b89ff;
  }
</style>
