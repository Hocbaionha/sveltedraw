// PluginRegistry — reactive store for all registered plugin extensions.
// App.svelte reads registry.toolbarItems / sidePanels / canvasOverlays to
// render dynamic UI; plugins push into these arrays via SveltedrawPluginContext.

import type {
  ToolbarItemDef,
  SidePanelDef,
  CanvasOverlayDef,
  MainMenuItemDef,
  ChromeItemDef,
  ContextMenuItemDef,
  PointerEventType,
  PointerObserver,
  MutationFilter,
  MutationFilterContext,
  MutationFilterResult,
  SveltedrawPlugin,
  SveltedrawPluginContext,
} from "./types.js";
import type { ActionManager } from "../actions/manager.svelte.js";

export const PLUGIN_REGISTRY_KEY: unique symbol = Symbol("pluginRegistry");

export class PluginRegistry {
  toolbarItems = $state<ToolbarItemDef[]>([]);
  sidePanels = $state<SidePanelDef[]>([]);
  canvasOverlays = $state<CanvasOverlayDef[]>([]);
  menuItems = $state<MainMenuItemDef[]>([]);
  chromeItems = $state<ChromeItemDef[]>([]);
  contextMenuItems = $state<ContextMenuItemDef[]>([]);

  /**
   * Pointer event observers, keyed by event type. Each observer is
   * dispatched per matching event from the editor surface; throws are
   * caught + logged so a buggy observer can't break the pipeline.
   */
  private pointerObservers = new Map<PointerEventType, Set<PointerObserver>>();

  /** Mutation filters in registration order. */
  private mutationFilters: MutationFilter[] = [];

  /**
   * Editor-ready bookkeeping. `editorReady` flips true on the first
   * `markEditorReady()` call from the host. Callbacks registered before
   * that point are queued; once ready, new callbacks fire synchronously.
   * Each callback may return a teardown closure, recorded so `uninstall`
   * runs them.
   */
  private editorReady = false;
  private editorReadyCallbacks: (() => void | (() => void))[] = [];
  private editorReadyTeardowns = new Map<string, (() => void)[]>();

  /**
   * Plugin-published stores keyed by Symbol. Single-writer: a key can
   * be claimed by at most one plugin at a time; subsequent provideStore
   * calls on the same key throw to surface accidental collisions early.
   * Read access via getStore — falsy `undefined` for unknown keys.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private stores = new Map<symbol, any>();

  /**
   * Reactive version counter — bumped on every provideStore / release.
   * getStore reads it so $derived/$effect consumers re-run when the set
   * of published stores changes (i.e. a plugin installs late and now
   * has a store to hand out). Without this, a $derived that runs before
   * a plugin installs would never subscribe to anything reactive, then
   * fail to re-evaluate once the store appears.
   */
  private storesVersion = $state(0);

  /**
   * ActionManager handle. Set once at editor construction via
   * `attachActionManager`. Plugins reach it through `ctx.addAction`,
   * which auto-qualifies the action id with the plugin prefix
   * (matching toolbar / panel / overlay item-id convention). When
   * unset, addAction calls fail loudly so missing wiring surfaces
   * during plugin install rather than silently dropping commands.
   */
  private actionManager: ActionManager | null = null;

  attachActionManager(am: ActionManager): void {
    this.actionManager = am;
  }

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

  /** Uninstall: run cleanup and strip all items registered by that plugin.
   *  Cleanup runs in a try block so a throwing plugin doesn't leave
   *  zombie toolbar/panel entries behind — the registry-side teardown
   *  always completes. */
  uninstall(pluginId: string): void {
    // Run any onEditorReady teardowns first — they may close
    // network connections or detach DOM listeners that the plugin's
    // own cleanup function depends on having torn down already.
    const teardowns = this.editorReadyTeardowns.get(pluginId);
    if (teardowns) {
      for (const t of teardowns) {
        try { t(); } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[plugin:${pluginId}] editor-ready teardown threw`, err);
        }
      }
      this.editorReadyTeardowns.delete(pluginId);
    }
    try {
      this.cleanups.get(pluginId)?.();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[plugin:${pluginId}] cleanup threw`, err);
    }
    this.cleanups.delete(pluginId);
    // Items are identified by the prefix convention enforced in buildContext.
    const prefix = `${pluginId}/`;
    this.toolbarItems = this.toolbarItems.filter((i) => !i.id.startsWith(prefix));
    this.sidePanels = this.sidePanels.filter((p) => !p.id.startsWith(prefix));
    this.canvasOverlays = this.canvasOverlays.filter((o) => !o.id.startsWith(prefix));
    this.menuItems = this.menuItems.filter((m) => !m.id.startsWith(prefix));
    this.chromeItems = this.chromeItems.filter((c) => !c.id.startsWith(prefix));
    this.contextMenuItems = this.contextMenuItems.filter((c) => !c.id.startsWith(prefix));
  }

  /** Read a published store. Returns undefined if no plugin has
   *  claimed the key. Built-in editor code (App.svelte / honest-tests)
   *  uses this to discover plugin functionality without an import. */
  getStore<T>(key: symbol): T | undefined {
    // Touch the reactive version so $derived consumers re-run when a
    // plugin provides/releases a store after this $derived first ran.
    void this.storesVersion;
    return this.stores.get(key) as T | undefined;
  }

  /**
   * Dispatch a pointer event to every registered observer of `type`.
   * Called by the host (App.svelte) from its pointer handlers; not
   * for plugin use. Observers run AFTER the editor's own logic so they
   * can never be the reason for a missed/swallowed event.
   */
  dispatchPointerEvent(
    type: PointerEventType,
    event: PointerEvent | MouseEvent,
    sceneCoords: { x: number; y: number },
  ): void {
    const observers = this.pointerObservers.get(type);
    if (!observers || observers.size === 0) return;
    for (const obs of observers) {
      try {
        obs(event, sceneCoords);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[plugin] pointer observer (${type}) threw`, err);
      }
    }
  }

  /**
   * Run installed mutation filters. Returns true if every filter
   * allowed the mutation; false (with optional reason in the
   * console) if any blocked it. Host code calls this at the gates
   * it cares about (drag start, transform, delete, etc.).
   */
  canMutate(ctx: MutationFilterContext): boolean {
    if (this.mutationFilters.length === 0) return true;
    for (const filter of this.mutationFilters) {
      let result: MutationFilterResult;
      try {
        result = filter(ctx);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[plugin] mutation filter threw", err);
        // A throwing filter is treated as "didn't block" — surfacing
        // the error in the console is enough; failing closed would
        // make a buggy plugin lock the entire editor.
        continue;
      }
      if (result === true) continue;
      if (result === false) return false;
      if (result && result.allowed === false) {
        // eslint-disable-next-line no-console
        console.info(
          `[plugin] mutation blocked (${ctx.intent} on ${ctx.elementId}): ${result.reason}`,
        );
        return false;
      }
    }
    return true;
  }

  /**
   * Mark the editor as ready. Called once by App.svelte after first
   * scene paint. Fires every queued `onEditorReady` callback in
   * registration order; subsequent registrations fire immediately.
   */
  markEditorReady(): void {
    if (this.editorReady) return;
    this.editorReady = true;
    for (const cb of this.editorReadyCallbacks) {
      try {
        const teardown = cb();
        // Teardowns from queued callbacks aren't tied to a specific
        // pluginId here (they were registered through the plugin
        // context's onEditorReady, which records into editorReadyTeardowns
        // under the pluginId key). The synchronous-fire path below
        // handles the same plumbing for late registrations.
        void teardown;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[plugin] editor-ready callback threw", err);
      }
    }
    this.editorReadyCallbacks.length = 0;
  }

  isEditorReady(): boolean {
    return this.editorReady;
  }

  /**
   * Open one exclusive side panel and close every other exclusive one.
   * The registry walks `sidePanels`, calls `setOpen(false)` on each
   * exclusive panel that isn't the target, then `setOpen(true)` on the
   * target. Pass null to close all exclusives.
   */
  openExclusiveSidePanel(panelId: string | null): void {
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
        registry.storesVersion++;
        ownedStoreKeys.push(key);
        return () => {
          if (registry.stores.get(key) === store) {
            registry.stores.delete(key);
            registry.storesVersion++;
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
      addAction: (action) => {
        if (!registry.actionManager) {
          throw new Error(
            `[plugin:${pluginId}] addAction called before attachActionManager — host must wire the ActionManager before plugin install`,
          );
        }
        const qualified = { ...action, id: qualify(action.id) };
        return registry.actionManager.register(qualified);
      },
      addChromeItem: (item) => {
        const qualified = { ...item, id: qualify(item.id) };
        registry.chromeItems = [...registry.chromeItems, qualified];
        return () => {
          registry.chromeItems = registry.chromeItems.filter(
            (c) => c.id !== qualified.id,
          );
        };
      },
      addContextMenuItem: (item) => {
        const qualified = { ...item, id: qualify(item.id) };
        registry.contextMenuItems = [...registry.contextMenuItems, qualified];
        return () => {
          registry.contextMenuItems = registry.contextMenuItems.filter(
            (c) => c.id !== qualified.id,
          );
        };
      },
      onPointerEvent: (type, observer) => {
        if (!registry.pointerObservers.has(type)) {
          registry.pointerObservers.set(type, new Set());
        }
        registry.pointerObservers.get(type)!.add(observer);
        return () => {
          registry.pointerObservers.get(type)?.delete(observer);
        };
      },
      addMutationFilter: (filter) => {
        registry.mutationFilters.push(filter);
        return () => {
          const i = registry.mutationFilters.indexOf(filter);
          if (i >= 0) registry.mutationFilters.splice(i, 1);
        };
      },
      onEditorReady: (cb) => {
        // Fire-or-queue. When the editor is already ready (plugin
        // installed late), invoke synchronously and record any
        // returned teardown under the plugin id so uninstall runs it.
        // When not yet ready, queue with the same per-plugin teardown
        // bookkeeping handled at fire time.
        const fire = () => {
          let teardown: void | (() => void);
          try {
            teardown = cb();
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(
              `[plugin:${pluginId}] onEditorReady callback threw`,
              err,
            );
            return;
          }
          if (typeof teardown === "function") {
            const list = registry.editorReadyTeardowns.get(pluginId) ?? [];
            list.push(teardown);
            registry.editorReadyTeardowns.set(pluginId, list);
          }
        };
        if (registry.editorReady) fire();
        else registry.editorReadyCallbacks.push(fire);
      },
      onSceneChange: api.onChange.bind(api),
      onSelectionChange: api.onSelectionChange.bind(api),
      onToolChange: api.onToolChange.bind(api),
    };
  }
}
