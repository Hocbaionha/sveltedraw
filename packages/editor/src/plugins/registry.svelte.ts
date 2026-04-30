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

  /**
   * Plugin-published stores keyed by Symbol. Single-writer: a key can
   * be claimed by at most one plugin at a time; subsequent provideStore
   * calls on the same key throw to surface accidental collisions early.
   * Read access via getStore — falsy `undefined` for unknown keys.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private stores = new Map<symbol, any>();

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
    // Track stores claimed during install so uninstall releases them
    // even if the plugin author forgets to wire them into their cleanup.
    const claimedKeys: symbol[] = [];
    const wrappedCtx: SveltedrawPluginContext = {
      ...ctx,
      provideStore: <T>(key: symbol, store: T) => {
        const release = ctx.provideStore(key, store);
        claimedKeys.push(key);
        return release;
      },
    };
    const cleanup = plugin.install(wrappedCtx);
    this.cleanups.set(plugin.id, () => {
      cleanup?.();
      // Defensive store cleanup: release any keys the plugin claimed
      // and didn't unwind itself.
      for (const k of claimedKeys) {
        this.stores.delete(k);
      }
    });
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

  /** Read a published store. Returns undefined if no plugin has
   *  claimed the key. Built-in editor code (App.svelte / honest-tests)
   *  uses this to discover plugin functionality without an import. */
  getStore<T>(key: symbol): T | undefined {
    return this.stores.get(key) as T | undefined;
  }

  /**
   * External side-panel closers — callbacks the host (App.svelte)
   * registers so the registry can close inline-rendered side panels
   * when an exclusive plugin panel opens. Without this, opening a
   * plugin exclusive panel would leave inline panels (Grid, Layer,
   * Library at time of writing) visually stacked on the same right-
   * side anchor.
   */
  private externalSidePanelClosers: (() => void)[] = [];

  /**
   * Register a function the registry should invoke before opening any
   * exclusive side panel. Use for inline (non-plugin) panels that
   * occupy the same screen real estate as plugin panels. Returns a
   * dispose fn that unregisters the closer.
   */
  registerExternalSidePanelCloser(cb: () => void): () => void {
    this.externalSidePanelClosers.push(cb);
    return () => {
      const i = this.externalSidePanelClosers.indexOf(cb);
      if (i >= 0) this.externalSidePanelClosers.splice(i, 1);
    };
  }

  /**
   * Open one exclusive side panel and close every other exclusive one.
   * Also calls every registered external closer so inline (non-plugin)
   * panels close in lockstep. The registry walks `sidePanels`, calls
   * `setOpen(false)` on each exclusive panel that isn't the target,
   * then `setOpen(true)` on the target. Pass null to close all
   * exclusives + all inline panels.
   */
  openExclusiveSidePanel(panelId: string | null): void {
    // External closers run first — closing inline panels before plugin
    // panels means a brief frame won't show both classes of panel.
    for (const cb of this.externalSidePanelClosers) {
      try { cb(); } catch { /* swallow — one closer's failure shouldn't block others */ }
    }
    for (const p of this.sidePanels) {
      if (!p.exclusive || !p.setOpen) continue;
      const isTarget = p.id === panelId;
      // Only flip state when needed — avoids stomping on un-changed panels
      // (which would still trigger reactive subscribers).
      if (p.isOpen?.() !== isTarget) p.setOpen(isTarget);
    }
  }

  /**
   * Toggle one exclusive panel: if already open → close it; otherwise
   * open it (closing all other exclusives). Returns the new open state.
   */
  toggleExclusiveSidePanel(panelId: string): boolean {
    const target = this.sidePanels.find((p) => p.id === panelId);
    if (!target?.exclusive || !target.isOpen || !target.setOpen) return false;
    if (target.isOpen()) {
      target.setOpen(false);
      return false;
    }
    this.openExclusiveSidePanel(panelId);
    return true;
  }

  /** Snapshot of currently-open exclusive panel ids. */
  get openExclusivePanelIds(): readonly string[] {
    return this.sidePanels
      .filter((p) => p.exclusive && p.isOpen?.())
      .map((p) => p.id);
  }

  /**
   * Build a SveltedrawPluginContext scoped to the given plugin id.
   * `bridgeGetStore` lets the host fall back to a Svelte-context-keyed
   * store when no plugin has claimed the symbol — used for non-plugin
   * stores like SVELTEDRAW_API_KEY.
   */
  buildContext(
    pluginId: string,
    api: SveltedrawPluginContext["api"],
    tunnels: SveltedrawPluginContext["tunnels"],
    bridgeGetStore: <T>(key: symbol) => T | undefined,
  ): SveltedrawPluginContext {
    const registry = this;
    // Track which store keys this plugin claimed so uninstall can
    // tear them down. The cleanup map already stores a single fn per
    // plugin; we accumulate per-plugin store cleanups into a closure
    // that runs at uninstall time.
    const ownedStoreKeys: symbol[] = [];

    // Ensure item ids carry the plugin prefix so uninstall can target them
    // without requiring plugins to manually namespace their ids.
    const qualify = (id: string) =>
      id.startsWith(`${pluginId}/`) ? id : `${pluginId}/${id}`;

    return {
      api,
      tunnels,
      provideStore: <T>(key: symbol, store: T) => {
        if (registry.stores.has(key)) {
          throw new Error(
            `[plugin:${pluginId}] store key already claimed by another plugin`,
          );
        }
        registry.stores.set(key, store);
        ownedStoreKeys.push(key);
        return () => {
          if (registry.stores.get(key) === store) {
            registry.stores.delete(key);
          }
        };
      },
      // Read order: registry-published store first, then the host's
      // own context (Svelte setContext) so symbols like SVELTEDRAW_API_KEY
      // continue to resolve through the existing context tree.
      getStore: <T>(key: symbol): T | undefined => {
        const fromRegistry = registry.stores.get(key);
        if (fromRegistry !== undefined) return fromRegistry as T;
        return bridgeGetStore<T>(key);
      },
      toggleExclusiveSidePanel: (localPanelId: string): boolean =>
        registry.toggleExclusiveSidePanel(qualify(localPanelId)),
      closeAllExclusiveSidePanels: (): void =>
        registry.openExclusiveSidePanel(null),
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
