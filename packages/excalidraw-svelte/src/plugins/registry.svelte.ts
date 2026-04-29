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

  /** Install a plugin and store its cleanup. */
  install(plugin: SveltedrawPlugin, ctx: SveltedrawPluginContext): void {
    if (this.cleanups.has(plugin.id)) return; // already installed
    const cleanup = plugin.install(ctx);
    if (cleanup) this.cleanups.set(plugin.id, cleanup);
  }

  /** Uninstall: run cleanup and strip all items registered by that plugin. */
  uninstall(pluginId: string): void {
    this.cleanups.get(pluginId)?.();
    this.cleanups.delete(pluginId);
    this.toolbarItems = this.toolbarItems.filter((i) => !i.id.startsWith(`${pluginId}:`));
    this.sidePanels = this.sidePanels.filter((p) => !p.id.startsWith(`${pluginId}:`));
    this.canvasOverlays = this.canvasOverlays.filter((o) => !o.id.startsWith(`${pluginId}:`));
    this.menuItems = this.menuItems.filter((m) => !m.id.startsWith(`${pluginId}:`));
  }

  /** Build a SveltedrawPluginContext scoped to the given plugin id. */
  buildContext(pluginId: string, api: SveltedrawPluginContext["api"], tunnels: SveltedrawPluginContext["tunnels"], getStore: SveltedrawPluginContext["getStore"]): SveltedrawPluginContext {
    const registry = this;
    return {
      api,
      tunnels,
      getStore,
      addToolbarItem: (item) => {
        registry.toolbarItems = [...registry.toolbarItems, item];
        return () => { registry.toolbarItems = registry.toolbarItems.filter((i) => i.id !== item.id); };
      },
      addSidePanel: (panel) => {
        registry.sidePanels = [...registry.sidePanels, panel];
        return () => { registry.sidePanels = registry.sidePanels.filter((p) => p.id !== panel.id); };
      },
      addCanvasOverlay: (overlay) => {
        registry.canvasOverlays = [...registry.canvasOverlays, overlay];
        return () => { registry.canvasOverlays = registry.canvasOverlays.filter((o) => o.id !== overlay.id); };
      },
      addMainMenuItem: (item) => {
        registry.menuItems = [...registry.menuItems, item];
        return () => { registry.menuItems = registry.menuItems.filter((m) => m.id !== item.id); };
      },
      onSceneChange: api.onChange.bind(api),
      onSelectionChange: api.onSelectionChange.bind(api),
      onToolChange: api.onToolChange.bind(api),
    };
  }
}
