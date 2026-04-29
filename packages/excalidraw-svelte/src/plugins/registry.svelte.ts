// PluginRegistry — reactive store for all registered plugin extensions.
// App.svelte reads registry.toolbarItems / sidePanels / canvasOverlays to
// render dynamic UI; plugins push into these arrays via SveltedrawPluginContext.

import type {
  ToolbarItemDef,
  SidePanelDef,
  CanvasOverlayDef,
  MainMenuItemDef,
  SveltedrawPlugin,
  SveltedrawPluginContext,
} from "./types.js";

export const PLUGIN_REGISTRY_KEY: unique symbol = Symbol("pluginRegistry");

export class PluginRegistry {
  toolbarItems = $state<ToolbarItemDef[]>([]);
  sidePanels = $state<SidePanelDef[]>([]);
  canvasOverlays = $state<CanvasOverlayDef[]>([]);
  menuItems = $state<MainMenuItemDef[]>([]);

  private cleanups = new Map<string, () => void>();

  /** Whether a plugin is currently installed (O(1), no allocation). */
  isInstalled(pluginId: string): boolean {
    return this.cleanups.has(pluginId);
  }

  /** IDs of currently installed plugins. */
  get installedIds(): ReadonlySet<string> {
    return new Set(this.cleanups.keys());
  }

  /** Install a plugin and store its cleanup. */
  install(plugin: SveltedrawPlugin, ctx: SveltedrawPluginContext): void {
    if (this.cleanups.has(plugin.id)) return; // already installed
    const cleanup = plugin.install(ctx);
    // Always record an entry so we can detect installed state even when there
    // is no cleanup function.
    this.cleanups.set(plugin.id, cleanup ?? (() => {}));
  }

  /** Uninstall: run cleanup and strip all items registered by that plugin. */
  uninstall(pluginId: string): void {
    this.cleanups.get(pluginId)?.();
    this.cleanups.delete(pluginId);
    // Items are identified by the prefix convention enforced in buildContext.
    const prefix = `${pluginId}/`;
    this.toolbarItems = this.toolbarItems.filter((i) => !i.id.startsWith(prefix));
    this.sidePanels = this.sidePanels.filter((p) => !p.id.startsWith(prefix));
    this.canvasOverlays = this.canvasOverlays.filter((o) => !o.id.startsWith(prefix));
    this.menuItems = this.menuItems.filter((m) => !m.id.startsWith(prefix));
  }

  /** Build a SveltedrawPluginContext scoped to the given plugin id. */
  buildContext(
    pluginId: string,
    api: SveltedrawPluginContext["api"],
    tunnels: SveltedrawPluginContext["tunnels"],
    getStore: SveltedrawPluginContext["getStore"],
  ): SveltedrawPluginContext {
    const registry = this;

    // Ensure item ids carry the plugin prefix so uninstall can target them
    // without requiring plugins to manually namespace their ids.
    const qualify = (id: string) =>
      id.startsWith(`${pluginId}/`) ? id : `${pluginId}/${id}`;

    return {
      api,
      tunnels,
      getStore,
      addToolbarItem: (item) => {
        const qualified = { ...item, id: qualify(item.id) };
        registry.toolbarItems = [...registry.toolbarItems, qualified];
        return () => {
          registry.toolbarItems = registry.toolbarItems.filter((i) => i.id !== qualified.id);
        };
      },
      addSidePanel: (panel) => {
        const qualified = { ...panel, id: qualify(panel.id) };
        registry.sidePanels = [...registry.sidePanels, qualified];
        return () => {
          registry.sidePanels = registry.sidePanels.filter((p) => p.id !== qualified.id);
        };
      },
      addCanvasOverlay: (overlay) => {
        const qualified = { ...overlay, id: qualify(overlay.id) };
        registry.canvasOverlays = [...registry.canvasOverlays, qualified];
        return () => {
          registry.canvasOverlays = registry.canvasOverlays.filter((o) => o.id !== qualified.id);
        };
      },
      addMainMenuItem: (item) => {
        const qualified = { ...item, id: qualify(item.id) };
        registry.menuItems = [...registry.menuItems, qualified];
        return () => {
          registry.menuItems = registry.menuItems.filter((m) => m.id !== qualified.id);
        };
      },
      onSceneChange: api.onChange.bind(api),
      onSelectionChange: api.onSelectionChange.bind(api),
      onToolChange: api.onToolChange.bind(api),
    };
  }
}
