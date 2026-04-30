<script lang="ts">
  // Top-right utility bar: file/templates/settings, tool toggles,
  // side panels, presentation, export, theme, language, help.
  //
  // Built-in buttons are hardcoded (drawing/utility/view groups). Plugin
  // buttons appended after the built-ins via PluginRegistry.toolbarItems
  // — each item carries an icon component, title, group, and onActivate.
  //
  // Note there are TWO "library" buttons — `libraryPanelOpen` is the
  // original bottom-left library panel; `shapeLibraryPanelActive` is
  // the side-docked Shape Library panel added in Phase 16.

  import { getContext } from "svelte";
  import { PLUGIN_REGISTRY_KEY, type PluginRegistry } from "../plugins/registry.svelte.js";
  import type { ToolbarItemDef } from "../plugins/types.js";

  type Language = { code: string; label: string };
  type SidePanelId =
    | "grid"
    | "layer"
    | "library";

  type Props = {
    libraryPanelOpen: boolean;
    connectorToolActive: boolean;
    laserActive: boolean;
    gridPanelActive: boolean;
    layerPanelActive: boolean;
    shapeLibraryPanelActive: boolean;
    theme: string;
    libraryLabel: string;
    currentLangCode: string;
    availableLanguages: readonly Language[];
    onToggleLibraryPanel: () => void;
    onToggleConnector: () => void;
    onToggleLaser: () => void;
    onCreateFrame: () => void;
    onToggleSidePanel: (panel: SidePanelId) => void;
    onStartPresentation: () => void;
    onOpenExport: () => void;
    onToggleTheme: () => void;
    onSetLanguage: (code: string) => void;
  };

  let {
    libraryPanelOpen,
    connectorToolActive,
    laserActive,
    gridPanelActive,
    layerPanelActive,
    shapeLibraryPanelActive,
    theme,
    libraryLabel,
    currentLangCode,
    availableLanguages,
    onToggleLibraryPanel,
    onToggleConnector,
    onToggleLaser,
    onCreateFrame,
    onToggleSidePanel,
    onStartPresentation,
    onOpenExport,
    onToggleTheme,
    onSetLanguage,
  }: Props = $props();

  // Plugin-contributed toolbar items. Optional context: hosts that build
  // a Sveltedraw editor without going through App.svelte's setContext
  // path won't have a registry — render zero plugin items in that case.
  const pluginRegistry =
    getContext<PluginRegistry | undefined>(PLUGIN_REGISTRY_KEY);

  // Group items so the visual ordering matches the existing groups
  // (drawing | utility | view). Re-derived only when the toolbar list
  // mutates (push/pop), not on item-internal state changes.
  const drawingItems = $derived<ToolbarItemDef[]>(
    pluginRegistry?.toolbarItems.filter((i) => i.group === "drawing") ?? [],
  );
  const utilityItems = $derived<ToolbarItemDef[]>(
    pluginRegistry?.toolbarItems.filter((i) => i.group === "utility") ?? [],
  );
  const viewItems = $derived<ToolbarItemDef[]>(
    pluginRegistry?.toolbarItems.filter((i) => i.group === "view") ?? [],
  );
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

  <!-- Plugin-contributed toolbar items, grouped to match the built-in
       layout. Each plugin's onActivate runs synchronously; isActive is
       polled at render time, so reactivity flows through whatever
       $state the plugin closes over. -->
  {#each drawingItems as item (item.id)}
    <button
      type="button"
      class="sveltedraw-util-btn"
      class:active={item.isActive?.()}
      aria-label={item.title}
      title={item.title}
      onclick={item.onActivate}
    >
      {#if typeof item.icon === "function"}
        {@const Icon = item.icon}
        <Icon />
      {/if}
    </button>
  {/each}
  {#each utilityItems as item (item.id)}
    <button
      type="button"
      class="sveltedraw-util-btn"
      class:active={item.isActive?.()}
      aria-label={item.title}
      title={item.title}
      onclick={item.onActivate}
    >
      {#if typeof item.icon === "function"}
        {@const Icon = item.icon}
        <Icon />
      {/if}
    </button>
  {/each}
  {#each viewItems as item (item.id)}
    <button
      type="button"
      class="sveltedraw-util-btn"
      class:active={item.isActive?.()}
      aria-label={item.title}
      title={item.title}
      onclick={item.onActivate}
    >
      {#if typeof item.icon === "function"}
        {@const Icon = item.icon}
        <Icon />
      {/if}
    </button>
  {/each}
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
  :global(.sveltedraw.theme--dark) .sveltedraw-util-btn {
    background: #232329;
    border-color: #363636;
    color: #e5e7ea;
  }
  :global(.sveltedraw.theme--dark) .sveltedraw-util-btn:hover {
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
