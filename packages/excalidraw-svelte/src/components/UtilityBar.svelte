<script lang="ts">
  // Top-right utility bar: file/templates/settings, tool toggles,
  // side panels, presentation, export, theme, language, help.
  //
  // All active-state flags are passed in as readonly props; the parent
  // owns the state. All actions are plain callbacks.
  //
  // Note there are TWO "library" buttons — `libraryPanelOpen` is the
  // original bottom-left library panel; `shapeLibraryPanelActive` is
  // the side-docked Shape Library panel added in Phase 16.

  type Language = { code: string; label: string };
  // Mirror of App.svelte's SidePanelId. Kept duplicated rather than
  // exported so the shared snapshot stays wherever it's used.
  type SidePanelId =
    | "alignment"
    | "measurement"
    | "autolayout"
    | "grid"
    | "layer"
    | "history"
    | "library";

  type Props = {
    libraryPanelOpen: boolean;
    connectorToolActive: boolean;
    laserActive: boolean;
    alignmentPanelActive: boolean;
    measurementPanelActive: boolean;
    autoLayoutPanelActive: boolean;
    gridPanelActive: boolean;
    layerPanelActive: boolean;
    historyPanelActive: boolean;
    shapeLibraryPanelActive: boolean;
    theme: string;
    libraryLabel: string;
    currentLangCode: string;
    availableLanguages: readonly Language[];
    onToggleLibraryPanel: () => void;
    onOpenTemplates: () => void;
    onOpenRecent: () => void;
    onOpenSettings: () => void;
    onToggleConnector: () => void;
    onToggleLaser: () => void;
    onCreateFrame: () => void;
    onToggleSidePanel: (panel: SidePanelId) => void;
    onStartPresentation: () => void;
    onOpenExport: () => void;
    onToggleTheme: () => void;
    onSetLanguage: (code: string) => void;
    onOpenHelp: () => void;
  };

  let {
    libraryPanelOpen,
    connectorToolActive,
    laserActive,
    alignmentPanelActive,
    measurementPanelActive,
    autoLayoutPanelActive,
    gridPanelActive,
    layerPanelActive,
    historyPanelActive,
    shapeLibraryPanelActive,
    theme,
    libraryLabel,
    currentLangCode,
    availableLanguages,
    onToggleLibraryPanel,
    onOpenTemplates,
    onOpenRecent,
    onOpenSettings,
    onToggleConnector,
    onToggleLaser,
    onCreateFrame,
    onToggleSidePanel,
    onStartPresentation,
    onOpenExport,
    onToggleTheme,
    onSetLanguage,
    onOpenHelp,
  }: Props = $props();
</script>

<div class="sveltedraw-utility-bar">
  <button
    type="button"
    class="sveltedraw-util-btn"
    class:active={libraryPanelOpen}
    aria-label={libraryLabel}
    title={libraryLabel}
    onclick={onToggleLibraryPanel}
  >
    📚
  </button>
  <button
    type="button"
    class="sveltedraw-util-btn"
    aria-label="New from template"
    title="New from template (Ctrl+N)"
    onclick={onOpenTemplates}
  >
    📋
  </button>
  <button
    type="button"
    class="sveltedraw-util-btn"
    aria-label="Recent files"
    title="Recent files (Ctrl+R)"
    onclick={onOpenRecent}
  >
    🕐
  </button>
  <button
    type="button"
    class="sveltedraw-util-btn"
    aria-label="Settings"
    title="Settings (Ctrl+,)"
    onclick={onOpenSettings}
  >
    ⚙️
  </button>
  <button
    type="button"
    class="sveltedraw-util-btn"
    class:active={connectorToolActive}
    aria-label="Connector tool"
    title="Connector tool (Ctrl+Shift+C)"
    onclick={onToggleConnector}
  >
    ⚡
  </button>
  <button
    type="button"
    class="sveltedraw-util-btn"
    class:active={laserActive}
    aria-label="Laser pointer"
    title="Laser pointer (K, L in presentation)"
    onclick={onToggleLaser}
  >
    ✦
  </button>
  <button
    type="button"
    class="sveltedraw-util-btn"
    aria-label="Create frame"
    title="New frame (Ctrl+Shift+F)"
    onclick={onCreateFrame}
  >
    ⬛
  </button>
  <button
    type="button"
    class="sveltedraw-util-btn"
    class:active={alignmentPanelActive}
    aria-label="Alignment tool"
    title="Alignment & Distribution (Ctrl+Alt+L, etc)"
    onclick={() => onToggleSidePanel("alignment")}
  >
    ◫
  </button>
  <button
    type="button"
    class="sveltedraw-util-btn"
    class:active={measurementPanelActive}
    aria-label="Measurements"
    title="Measurements & Dimensions (Ctrl+M)"
    onclick={() => onToggleSidePanel("measurement")}
  >
    📏
  </button>
  <button
    type="button"
    class="sveltedraw-util-btn"
    class:active={autoLayoutPanelActive}
    aria-label="Auto Layout"
    title="Auto Layout (Ctrl+L)"
    onclick={() => onToggleSidePanel("autolayout")}
  >
    🎯
  </button>
  <button
    type="button"
    class="sveltedraw-util-btn"
    class:active={gridPanelActive}
    aria-label="Grid & Snap"
    title="Grid & Snap Settings"
    onclick={() => onToggleSidePanel("grid")}
  >
    ⊞
  </button>
  <button
    type="button"
    class="sveltedraw-util-btn"
    class:active={layerPanelActive}
    aria-label="Layers"
    title="Layer Management"
    onclick={() => onToggleSidePanel("layer")}
  >
    📑
  </button>
  <button
    type="button"
    class="sveltedraw-util-btn"
    class:active={historyPanelActive}
    aria-label="History"
    title="Undo/Redo History"
    onclick={() => onToggleSidePanel("history")}
  >
    ⏮
  </button>
  <button
    type="button"
    class="sveltedraw-util-btn"
    class:active={shapeLibraryPanelActive}
    aria-label="Shape Library"
    title="Shape Library & Components"
    onclick={() => onToggleSidePanel("library")}
  >
    📚
  </button>
  <button
    type="button"
    class="sveltedraw-util-btn"
    aria-label="Presentation"
    title="Start Presentation Mode"
    onclick={onStartPresentation}
  >
    🎬
  </button>
  <button
    type="button"
    class="sveltedraw-util-btn"
    aria-label="Export"
    title="Export Drawing"
    onclick={onOpenExport}
  >
    💾
  </button>
  <button
    type="button"
    class="sveltedraw-util-btn"
    aria-label="Toggle dark mode"
    title="Toggle dark mode"
    onclick={onToggleTheme}
  >
    {#if theme === "dark"}☀{:else}☾{/if}
  </button>
  <select
    class="sveltedraw-util-btn sveltedraw-lang-select"
    aria-label="Language"
    value={currentLangCode}
    onchange={(e) => onSetLanguage((e.currentTarget as HTMLSelectElement).value)}
  >
    {#each availableLanguages as lang (lang.code)}
      <option value={lang.code}>{lang.label}</option>
    {/each}
  </select>
  <button
    type="button"
    class="sveltedraw-util-btn"
    aria-label="Help"
    title="Help (F1)"
    onclick={onOpenHelp}
  >
    ❓
  </button>
</div>

<style>
  .sveltedraw-utility-bar {
    position: absolute;
    top: 64px;
    right: 12px;
    display: flex;
    gap: 6px;
    z-index: 50;
    flex-wrap: wrap;
    justify-content: flex-end;
    max-width: calc(100vw - 24px);
  }
  .sveltedraw-util-btn {
    height: 30px;
    padding: 0 10px;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 6px;
    cursor: pointer;
    color: #1e1e1e;
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .sveltedraw-util-btn:hover {
    background: #f1f3f5;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-util-btn {
    background: #232329;
    border-color: #363636;
    color: #e5e7ea;
  }
  :global(.excalidraw.theme--dark) .sveltedraw-util-btn:hover {
    background: #2e2e36;
  }
  .sveltedraw-lang-select {
    min-width: 120px;
  }
  .sveltedraw-util-btn.active {
    background: #eeedfa;
    border-color: #6965db;
  }
</style>
