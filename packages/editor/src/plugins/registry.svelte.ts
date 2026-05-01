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
  WindowEventType,
  ElementChangeObserver,
  ElementChangeContext,
  ToolPluginDef,
  ToolPointerContext,
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
   * Window-event observers, keyed by type. The host attaches the
   * underlying window listener lazily — only when the first observer
   * for a given type registers — and detaches when the last unsubscribes.
   * Saves a no-op listener cost for events no plugin cares about.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private windowObservers = new Map<WindowEventType, Set<(event: any) => void>>();
  private windowAttached = new Map<WindowEventType, () => void>();

  /** Element-mutation observers (registered via ctx.onElementChange). */
  private elementObservers = new Set<ElementChangeObserver>();

  /** Tool plugins, keyed by tool name. */
  private toolPlugins = new Map<string, ToolPluginDef>();

  /**
   * Active tool gesture. When a tool plugin's onPointerDown claims
   * the gesture (doesn't call passthrough), subsequent pointermove /
   * up / cancel are routed to the same tool until release. The host
   * checks this state before falling through to its built-in handlers.
   */
  private activeToolGesture: { name: string; pointerId: number | null } | null = null;

  /**
   * Per-plugin disposer registry. Every Tier-1/2 hook that returns
   * a dispose closure ALSO records that closure here under the
   * plugin id. Uninstall iterates and runs each — idempotent (each
   * dispose handles its own already-removed case), so plugins that
   * properly clean up in their own teardown pay nothing extra.
   *
   * This is the safety net behind the prefix-strip pattern used for
   * UI items (toolbar / panel / overlay / menu / chrome / context-
   * menu). Non-UI registrations (pointer observers / mutation filters
   * / window listeners / element observers / tools / actions) don't
   * carry a plugin-id-prefixed key, so the only way to sweep them
   * on uninstall is to remember the disposers per-plugin.
   */
  private pluginDisposers = new Map<string, Array<() => void>>();

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
    // even if the plugin author forgets to wire them into their
    // cleanup. Capture (key, value) pairs so the defensive sweep can
    // distinguish "still mine" from "claimed, released, then claimed
    // again by another plugin" — deleting unconditionally by key
    // would silently unpublish the second plugin's store.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const claimed: { key: symbol; value: any }[] = [];
    const wrappedCtx: SveltedrawPluginContext = {
      ...ctx,
      provideStore: <T>(key: symbol, store: T) => {
        const release = ctx.provideStore(key, store);
        claimed.push({ key, value: store });
        return release;
      },
    };
    const cleanup = plugin.install(wrappedCtx);
    this.cleanups.set(plugin.id, () => {
      cleanup?.();
      // Defensive store cleanup: release only entries whose value
      // matches what THIS plugin published. If another plugin has
      // taken the symbol since release, that other plugin's store
      // stays put.
      let touched = false;
      for (const { key, value } of claimed) {
        if (this.stores.get(key) === value) {
          this.stores.delete(key);
          touched = true;
        }
      }
      // Bump the reactive version so $derived consumers re-resolve
      // their getStore call after uninstall removes a store. Without
      // this, a consumer that read the store inside a $derived
      // wouldn't notice it disappeared.
      if (touched) this.storesVersion++;
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
    // Run any disposers the plugin's own cleanup didn't run. Each
    // wrapped dispose is idempotent — if the plugin already called
    // it, this is a no-op. Iterate a copy because the disposers
    // self-remove from the bucket as they fire.
    const remainingDisposers = this.pluginDisposers.get(pluginId);
    if (remainingDisposers) {
      for (const d of [...remainingDisposers]) d();
      this.pluginDisposers.delete(pluginId);
    }
    // UI items are identified by the prefix convention enforced in
    // buildContext. The prefix-strip is now a defense-in-depth net
    // beneath the disposer sweep above — disposers should have
    // already removed these entries; the filters catch anything that
    // slipped through (e.g. a plugin that mutated registry arrays
    // directly through the api, which it shouldn't).
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
    // Queued callbacks were wrapped by buildContext.onEditorReady to
    // capture their pluginId — `cb()` itself records any returned
    // teardown into editorReadyTeardowns under the right pluginId.
    // Nothing to do here besides invoke them in registration order.
    for (const cb of this.editorReadyCallbacks) {
      try {
        cb();
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
   * Dispatch element-change observers. Called by the host after gated
   * mutation paths (replaceAllElements, mutateElement) compute the
   * before/after snapshots. Skipping observers for unchanged elements
   * is the host's responsibility — observers see only actually-
   * mutated entries.
   */
  dispatchElementChange(ctx: ElementChangeContext): void {
    for (const obs of this.elementObservers) {
      try {
        obs(ctx);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[plugin] element-change observer threw", err);
      }
    }
  }

  /**
   * Tool-plugin pointer dispatch. Called by App.svelte's pointer
   * handlers BEFORE the host's built-in tool dispatch. Returns true
   * if a tool plugin handled the event AND claimed the gesture (the
   * host should skip its default flow for the rest of this gesture).
   * Returns false if no plugin claimed (host runs default).
   */
  dispatchToolPointerDown(
    activeToolName: string,
    ctxBuilder: (passthrough: () => void) => ToolPointerContext,
  ): boolean {
    const tool = this.toolPlugins.get(activeToolName);
    if (!tool || !tool.onPointerDown) return false;
    let claimed = true;
    const passthrough = () => { claimed = false; };
    const ctx = ctxBuilder(passthrough);
    try {
      tool.onPointerDown(ctx);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[plugin:tool:${activeToolName}] onPointerDown threw`, err);
      claimed = false;
    }
    if (claimed) {
      this.activeToolGesture = { name: activeToolName, pointerId: ctx.event.pointerId };
    }
    return claimed;
  }

  dispatchToolPointerMove(
    ctxBuilder: (passthrough: () => void) => ToolPointerContext,
  ): boolean {
    const gesture = this.activeToolGesture;
    if (!gesture) return false;
    const tool = this.toolPlugins.get(gesture.name);
    if (!tool || !tool.onPointerMove) return false;
    const passthrough = () => {};
    const ctx = ctxBuilder(passthrough);
    // Gate by pointerId — multi-touch sees pointermove from each
    // pointer and we only want the one that originally claimed the
    // gesture to flow through. Without this, a second finger landing
    // mid-drag would route every move through the tool too.
    if (gesture.pointerId !== null && ctx.event.pointerId !== gesture.pointerId) {
      return false;
    }
    try {
      tool.onPointerMove(ctx);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[plugin:tool:${gesture.name}] onPointerMove threw`, err);
    }
    return true;
  }

  dispatchToolPointerUp(
    ctxBuilder: (passthrough: () => void) => ToolPointerContext,
  ): boolean {
    const gesture = this.activeToolGesture;
    if (!gesture) return false;
    const tool = this.toolPlugins.get(gesture.name);
    const passthrough = () => {};
    const ctx = ctxBuilder(passthrough);
    if (gesture.pointerId !== null && ctx.event.pointerId !== gesture.pointerId) {
      return false;
    }
    try {
      tool?.onPointerUp?.(ctx);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[plugin:tool:${gesture.name}] onPointerUp threw`, err);
    }
    // Release the gesture claim — pointerup of the claiming pointerId
    // ends the gesture.
    this.activeToolGesture = null;
    return true;
  }

  dispatchToolPointerCancel(
    ctxBuilder: (passthrough: () => void) => ToolPointerContext,
  ): boolean {
    const gesture = this.activeToolGesture;
    if (!gesture) return false;
    const tool = this.toolPlugins.get(gesture.name);
    const passthrough = () => {};
    const ctx = ctxBuilder(passthrough);
    if (gesture.pointerId !== null && ctx.event.pointerId !== gesture.pointerId) {
      return false;
    }
    try {
      tool?.onPointerCancel?.(ctx);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[plugin:tool:${gesture.name}] onPointerCancel threw`, err);
    }
    this.activeToolGesture = null;
    return true;
  }

  /**
   * Drop any in-flight tool-plugin gesture claim. Called by the host
   * when something invalidates the gesture out-of-band — typically
   * a second touch landing (pinch start), a tool switch happening
   * mid-drag, or a pointercancel event.
   *
   * Idempotent. Does NOT fire onDeactivate (the tool is still the
   * active tool, just no gesture in flight).
   */
  cancelActiveToolGesture(): void {
    this.activeToolGesture = null;
  }

  /**
   * Notify the registry that the active tool changed. Fires the
   * outgoing tool's onDeactivate + the incoming tool's onActivate.
   * Called by App.svelte's setActiveTool.
   */
  notifyToolChange(prev: string | null, next: string | null): void {
    if (prev === next) return;
    if (prev) {
      try {
        this.toolPlugins.get(prev)?.onDeactivate?.();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[plugin:tool:${prev}] onDeactivate threw`, err);
      }
    }
    if (next) {
      try {
        this.toolPlugins.get(next)?.onActivate?.();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[plugin:tool:${next}] onActivate threw`, err);
      }
    }
    // Drop any stale gesture claim — tool change kills the gesture.
    this.activeToolGesture = null;
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

    /**
     * Wrap a dispose closure so the registry remembers it under
     * pluginId. The returned closure is BOTH idempotent (the inner
     * dispose's behavior + a flag here) and self-removing (calling
     * it manually unhooks the registry-side reference). On
     * uninstall, the registry iterates remaining wrapped disposers
     * and calls them.
     */
    const track = (dispose: () => void): (() => void) => {
      let disposed = false;
      const wrapped = () => {
        if (disposed) return;
        disposed = true;
        try { dispose(); } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[plugin:${pluginId}] dispose threw`, err);
        }
        // Remove from the per-plugin bucket so uninstall doesn't
        // try to call it again.
        const list = registry.pluginDisposers.get(pluginId);
        if (list) {
          const i = list.indexOf(wrapped);
          if (i >= 0) list.splice(i, 1);
        }
      };
      const list = registry.pluginDisposers.get(pluginId) ?? [];
      list.push(wrapped);
      registry.pluginDisposers.set(pluginId, list);
      return wrapped;
    };

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
        return track(() => {
          if (registry.stores.get(key) === store) {
            registry.stores.delete(key);
            registry.storesVersion++;
          }
        });
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
        return track(() => {
          registry.toolbarItems = registry.toolbarItems.filter((i) => i.id !== qualified.id);
        });
      },
      addSidePanel: (panel) => {
        const qualified = { ...panel, id: qualify(panel.id) };
        registry.sidePanels = [...registry.sidePanels, qualified];
        return track(() => {
          registry.sidePanels = registry.sidePanels.filter((p) => p.id !== qualified.id);
        });
      },
      addCanvasOverlay: (overlay) => {
        const qualified = { ...overlay, id: qualify(overlay.id) };
        registry.canvasOverlays = [...registry.canvasOverlays, qualified];
        return track(() => {
          registry.canvasOverlays = registry.canvasOverlays.filter((o) => o.id !== qualified.id);
        });
      },
      addMainMenuItem: (item) => {
        const qualified = { ...item, id: qualify(item.id) };
        registry.menuItems = [...registry.menuItems, qualified];
        return track(() => {
          registry.menuItems = registry.menuItems.filter((m) => m.id !== qualified.id);
        });
      },
      addAction: (action) => {
        if (!registry.actionManager) {
          throw new Error(
            `[plugin:${pluginId}] addAction called before attachActionManager — host must wire the ActionManager before plugin install`,
          );
        }
        const qualified = { ...action, id: qualify(action.id) };
        const dispose = registry.actionManager.register(qualified);
        return track(dispose);
      },
      addChromeItem: (item) => {
        const qualified = { ...item, id: qualify(item.id) };
        registry.chromeItems = [...registry.chromeItems, qualified];
        return track(() => {
          registry.chromeItems = registry.chromeItems.filter(
            (c) => c.id !== qualified.id,
          );
        });
      },
      addContextMenuItem: (item) => {
        const qualified = { ...item, id: qualify(item.id) };
        registry.contextMenuItems = [...registry.contextMenuItems, qualified];
        return track(() => {
          registry.contextMenuItems = registry.contextMenuItems.filter(
            (c) => c.id !== qualified.id,
          );
        });
      },
      onPointerEvent: (type, observer) => {
        if (!registry.pointerObservers.has(type)) {
          registry.pointerObservers.set(type, new Set());
        }
        registry.pointerObservers.get(type)!.add(observer);
        return track(() => {
          registry.pointerObservers.get(type)?.delete(observer);
        });
      },
      addMutationFilter: (filter) => {
        registry.mutationFilters.push(filter);
        return track(() => {
          const i = registry.mutationFilters.indexOf(filter);
          if (i >= 0) registry.mutationFilters.splice(i, 1);
        });
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onWindowEvent: (type, observer: (event: any) => void) => {
        let observers = registry.windowObservers.get(type);
        if (!observers) {
          observers = new Set();
          registry.windowObservers.set(type, observers);
          // Lazy attach: only the first observer for this type
          // installs the underlying window listener. Subsequent
          // registrations share it. This keeps idle plugins cheap.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const handler = (event: any) => {
            const obs = registry.windowObservers.get(type);
            if (!obs) return;
            for (const cb of obs) {
              try {
                cb(event);
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error(`[plugin] window observer (${type}) threw`, err);
              }
            }
          };
          window.addEventListener(type, handler);
          registry.windowAttached.set(type, () => {
            window.removeEventListener(type, handler);
          });
        }
        observers.add(observer);
        return track(() => {
          const set = registry.windowObservers.get(type);
          if (!set) return;
          set.delete(observer);
          // Last observer left — detach the underlying window
          // listener so the editor doesn't leak it across hot reload.
          if (set.size === 0) {
            registry.windowObservers.delete(type);
            registry.windowAttached.get(type)?.();
            registry.windowAttached.delete(type);
          }
        });
      },
      onElementChange: <T>(observer: ElementChangeObserver<T>) => {
        registry.elementObservers.add(observer as ElementChangeObserver);
        return track(() => {
          registry.elementObservers.delete(observer as ElementChangeObserver);
        });
      },
      registerTool: (def) => {
        if (registry.toolPlugins.has(def.name)) {
          throw new Error(
            `[plugin:${pluginId}] tool name "${def.name}" already registered`,
          );
        }
        registry.toolPlugins.set(def.name, def);
        return track(() => {
          // If the tool is currently the editor's active tool — read
          // from the api, since "active tool" and "gesture in flight"
          // are different concepts (you can have the tool selected
          // with no pointerdown). Fire onDeactivate first so the
          // plugin can tear down transient state, then drop any
          // gesture claim, then unregister.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const liveAppState = api.getAppState() as any;
          const activeName = liveAppState?.activeTool?.type ?? null;
          if (activeName === def.name) {
            try { def.onDeactivate?.(); } catch (err) {
              // eslint-disable-next-line no-console
              console.error(`[plugin:tool:${def.name}] onDeactivate threw on dispose`, err);
            }
          }
          if (registry.activeToolGesture?.name === def.name) {
            registry.activeToolGesture = null;
          }
          if (registry.toolPlugins.get(def.name) === def) {
            registry.toolPlugins.delete(def.name);
          }
        });
      },
      onSceneChange: api.onChange.bind(api),
      onSelectionChange: api.onSelectionChange.bind(api),
      onToolChange: api.onToolChange.bind(api),
    };
  }
}
