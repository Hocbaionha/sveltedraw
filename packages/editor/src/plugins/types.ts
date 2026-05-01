// Plugin system types. A SveltedrawPlugin is the unit of OCP extension:
// adding a feature = dropping a plugin file, zero modifications to App.svelte.

import type { Component, Snippet } from "svelte";
import type { SveltedrawAPI } from "../api/types.js";
import type { TunnelsContext } from "../state/tunnels.svelte.js";
import type { Action } from "../actions/types.js";

export interface ToolbarItemDef {
  id: string;
  /** Svelte 5 component or snippet rendered as the button icon. */
  icon: Component | Snippet;
  title: string;
  shortcut?: string;
  group: "drawing" | "utility" | "view";
  isActive?: () => boolean;
  onActivate: () => void;
}

export interface SidePanelDef {
  id: string;
  title: string;
  triggerIcon: Component | Snippet;
  /** Svelte 5 component mounted when the panel is open. */
  component: Component;
  /**
   * If true, the panel participates in mutual-exclusion: opening it
   * closes every other exclusive panel. Plugins implement this by
   * exposing an `isOpen()` reader + `setOpen(v)` writer through the
   * registry's `setExclusiveOpen` API. Panels without this flag are
   * independent (e.g. floating overlays, modal-style dialogs).
   */
  exclusive?: boolean;
  /**
   * If exclusive, this plugin's open/close hooks. Required when
   * `exclusive: true`. The registry calls `setOpen(false)` on every
   * other exclusive panel when this one opens.
   */
  isOpen?: () => boolean;
  setOpen?: (v: boolean) => void;
}

export interface CanvasOverlayDef {
  id: string;
  /** Svelte 5 component rendered above the canvas. */
  component: Component;
  zIndex: number;
  /** Whether the overlay intercepts pointer events. Default false. */
  pointerEvents?: boolean;
}

export interface MainMenuItemDef {
  id: string;
  label: string;
  icon?: Component | Snippet;
  shortcut?: string;
  onSelect: () => void;
}

/**
 * Pointer event observer types. The observer receives the raw browser
 * event PLUS pre-computed scene coordinates so plugins don't have to
 * redo viewport-to-scene math themselves. Observers cannot intercept
 * the event — they only see it. To capture the gesture (e.g. tool-
 * override modal) use a dedicated tool plugin or claim the active tool
 * via setActiveTool.
 */
export type PointerEventType =
  | "down"
  | "move"
  | "up"
  | "cancel"
  | "click"
  | "dblclick";

/**
 * Pointer observer payload. The host pre-computes scene coords AND
 * the element under the cursor (hit-test result, may be null) so
 * tooltip / hover / annotation plugins skip redoing that work. The
 * raw event is provided for plugins that need modifier-key state or
 * pointerType.
 *
 * Observers cannot block the event — they're read-only. To veto a
 * mutation triggered downstream of pointer input, register a
 * mutation filter (`addMutationFilter`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PointerObserver<TElement = any> = (
  event: PointerEvent | MouseEvent,
  sceneCoords: { x: number; y: number },
  hitElement: TElement | null,
) => void;

/**
 * Mutation intents — what kind of change a piece of editor code is
 * about to make. Mutation filters can veto by elementId × intent.
 *
 * - `create`: new element insert (id is the new element's id)
 * - `update`: in-place edit of one or more fields
 * - `delete`: removal (soft via isDeleted=true or hard from scene)
 * - `move`: position-only change (drag, arrow-key nudge)
 * - `transform`: resize / rotate / skew
 * - `style`: color / stroke / fill / opacity / shadow / etc.
 * - `text`: text content edit (separate from style)
 *
 * The intent gives plugins a single axis to gate on without inspecting
 * the patch contents. Multiple intents may apply to one mutation
 * (e.g. drag-resize is "move" + "transform"); the host calls
 * canMutate once per most-specific intent.
 */
export type MutationIntent =
  | "create"
  | "update"
  | "delete"
  | "move"
  | "transform"
  | "style"
  | "text";

export interface MutationFilterContext {
  /** The element id being mutated. May be a yet-to-be-inserted id for `create`. */
  elementId: string;
  intent: MutationIntent;
  /** Optional proposed patch — undefined for delete, pre-fill for create. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch?: any;
}

/** Filter result. `false` (or { allowed: false, reason }) blocks the
 *  mutation. `true` allows. Reason is shown to the user via toast. */
export type MutationFilterResult =
  | boolean
  | { allowed: false; reason: string };

export type MutationFilter = (
  ctx: MutationFilterContext,
) => MutationFilterResult;

/**
 * Window-level events plugins commonly want to observe without owning
 * a DOM listener themselves. The host attaches/detaches the underlying
 * window listener; plugins just register a callback.
 *
 * - `paste`: ClipboardEvent — image / text pastes from the OS clipboard
 * - `drop`: DragEvent — files dragged into the page
 * - `dragover`: DragEvent — used to allow drop targets (preventDefault
 *   inside the observer if you intend to handle drop)
 * - `beforeunload`: BeforeUnloadEvent — flush autosave, warn dirty state
 * - `visibilitychange`: Event — pause heavy work when tab hidden
 * - `online` / `offline`: Event — network status changes
 */
export type WindowEventType =
  | "paste"
  | "drop"
  | "dragover"
  | "beforeunload"
  | "visibilitychange"
  | "online"
  | "offline";

/**
 * Element-mutation observer types. These fire surgically per element
 * change rather than the coarser api.onChange (which fires once per
 * scene mutation regardless of what changed). Observers receive the
 * affected element id + the relevant snapshot.
 *
 * Use cases:
 * - text editor plugin reacting to its own element being edited
 * - snap-guides plugin recomputing on insert/move
 * - analytics / telemetry per element kind
 * - AI co-pilot suggesting completions on text element insert
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ElementChangeContext<T = any> = {
  /** The element id involved. */
  id: string;
  /** Post-change element (null for delete). */
  current: T | null;
  /** Pre-change element (null for insert). */
  previous: T | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ElementChangeObserver<T = any> = (
  ctx: ElementChangeContext<T>,
) => void;

/**
 * Tool-plugin context — what the host hands to a plugin's pointer
 * handlers when its tool is the active one. The plugin claims a
 * gesture by NOT calling `passthrough()` from onPointerDown; once
 * claimed, the host routes subsequent pointer events of the same
 * gesture to this tool only.
 *
 * `passthrough()` is meaningful ONLY in onPointerDown — call it to
 * let the host's default selection/drag flow handle the rest of the
 * gesture. In onPointerMove / onPointerUp / onPointerCancel the
 * passthrough callable is a no-op (the gesture's claim was decided
 * at pointerdown time and can't be retroactively given back). The
 * connector tool, for example, doesn't claim the gesture (it just
 * does a hit-test on pointerdown and calls handlePick), so its
 * onPointerDown would call passthrough().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolPointerContext<TElement = any> = {
  /** The raw browser event. */
  event: PointerEvent;
  /** Pre-computed scene coords. */
  sceneX: number;
  sceneY: number;
  /** Element under the cursor at event time, or null. */
  hitElement: TElement | null;
  /**
   * Down-only: lift the gesture lock so the host's default flow
   * handles the rest of the gesture. Calling this from move/up/cancel
   * is a silent no-op (the gesture is already claimed; releasing
   * mid-flight isn't supported — call onPointerCancel-style cleanup
   * inside your tool instead).
   */
  passthrough: () => void;
  /** Push a history snapshot. Call after committing a draw. */
  pushHistory: () => void;
  /** Force a static-canvas repaint. */
  bumpSceneRepaint: () => void;
};

/**
 * A tool plugin owns the pointer flow when its name is the active
 * tool. The host coordinates which tool is active via
 * `appState.activeTool.type` (existing convention) — when that
 * matches `name`, pointerdown/move/up/cancel route to this tool's
 * handlers BEFORE the host's built-in tool dispatch.
 *
 * Built-in tools (selection / rectangle / arrow / etc.) still live
 * in App.svelte's pointer handlers; tool plugins coexist alongside
 * them. The host falls through to its built-in dispatch for tool
 * names with no plugin claim.
 */
export interface ToolPluginDef {
  /** Tool identifier — must match the value the host writes to
   *  `appState.activeTool.type` when the user activates this tool.
   *  Plugin id is auto-prefixed in tool-action ids but NOT here —
   *  tools live in a flat namespace because activeTool.type is a
   *  flat string today (matches Excalidraw upstream). */
  name: string;
  /** Optional human-readable label for command-palette + tooltip. */
  label?: string;
  /** Called once when the tool becomes the active tool. Use to
   *  initialize transient state (drag origin, multi-step machine
   *  cursor, …). */
  onActivate?: () => void;
  /** Called once when the tool stops being active (user switched
   *  to another tool, Esc cancel, programmatic setActiveTool).
   *  Mirrors onActivate; both optional. */
  onDeactivate?: () => void;
  /**
   * Called from the host's pointerdown handler. Default behavior is
   * "claim the gesture": the host routes subsequent move / up /
   * cancel events to this tool until pointerup. Calling
   * `ctx.passthrough()` inside this handler is the OPT-OUT — the
   * host immediately falls through to its default behavior for this
   * pointerdown AND every subsequent event of the gesture.
   *
   * Return value is ignored. (Earlier drafts mentioned `{ claim: true }`;
   * that path was dropped — passthrough() is the single signal.)
   */
  onPointerDown?: (ctx: ToolPointerContext) => void;
  onPointerMove?: (ctx: ToolPointerContext) => void;
  onPointerUp?: (ctx: ToolPointerContext) => void;
  onPointerCancel?: (ctx: ToolPointerContext) => void;
}

/**
 * Chrome slots — well-known mount points OUTSIDE the canvas so plugins
 * can contribute UI that isn't a toolbar / side panel / canvas overlay.
 *
 * - `top-bar`: full-width strip above the toolbar (banners, breadcrumbs).
 * - `bottom-bar`: full-width strip below the canvas (status indicators,
 *   element count, zoom %).
 * - `left-rail`: vertical strip down the left edge of the editor. Used
 *   for style panels and other persistent tool-context UI. Pointer-
 *   events flow through (parent slot is pointer-events:none) so the
 *   rail itself doesn't block clicks; child components opt in.
 * - `right-rail`: mirror of left-rail along the right edge. Reserved
 *   for inspector / properties panels that aren't side panels (which
 *   are exclusive and animate in/out).
 * - `toast-layer`: stacked transient notifications, bottom-center.
 *   Plugins manage their own dismiss timing.
 * - `dialog-layer`: full-screen modal overlay. The plugin's component
 *   is responsible for backdrop + click-outside-to-close.
 */
export type ChromeSlot =
  | "top-bar"
  | "bottom-bar"
  | "left-rail"
  | "right-rail"
  | "toast-layer"
  | "dialog-layer";

export interface ChromeItemDef {
  id: string;
  slot: ChromeSlot;
  /** Parameter-less component. Plugins close over their own state via
   *  module-level bindings (same pattern as PanelHost). */
  component: Component;
  /** Stack order within the slot. Higher renders on top. Default 0. */
  zIndex?: number;
}

/**
 * Context-menu entry. The context menu opens on right-click on the
 * canvas; plugins contribute commands here for selection-aware actions.
 *
 * `predicate` runs at menu-open time with the live appState; entries
 * returning false are filtered out (rather than rendered disabled).
 * Reads inside predicate track reactively if the menu is open.
 */
export interface ContextMenuItemDef {
  id: string;
  label: string;
  icon?: Component | Snippet;
  /** Optional ordering hint within the menu. Default 0. */
  order?: number;
  /** Show this entry only when predicate returns true. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  predicate?: (appState: any) => boolean;
  onSelect: () => void;
}

export interface SveltedrawPluginContext {
  api: SveltedrawAPI;
  tunnels: TunnelsContext;

  addToolbarItem(item: ToolbarItemDef): () => void;
  addSidePanel(panel: SidePanelDef): () => void;
  addCanvasOverlay(overlay: CanvasOverlayDef): () => void;
  addMainMenuItem(item: MainMenuItemDef): () => void;

  /**
   * Register an Action with the editor's ActionManager. The plugin's
   * id is auto-prefixed onto action.id (so a plugin's "toggle" action
   * becomes `<plugin-id>/toggle`) — same convention as toolbar/panel
   * items. The dispose closure unregisters the action; uninstall
   * cleans it up automatically. See actions/types.ts for the Action
   * shape: id, label, optional hotkey/predicate/category/icon, and
   * the perform function.
   */
  addAction(action: Action): () => void;

  /**
   * Mount a UI component at a chrome slot OUTSIDE the canvas. Use for
   * banners, toasts, status bars, full-screen modals — anything that
   * doesn't fit toolbar / side-panel / canvas-overlay semantics.
   * Returns a dispose closure; uninstall releases automatically.
   */
  addChromeItem(item: ChromeItemDef): () => void;

  /**
   * Add a right-click context-menu entry. Predicate is re-evaluated
   * each time the menu opens; non-matching entries are filtered out
   * (not just disabled). Entries are sorted by `order` then insertion.
   */
  addContextMenuItem(item: ContextMenuItemDef): () => void;

  /**
   * Observe pointer events on the editor surface. Read-only — observers
   * cannot preventDefault or stop propagation. The observer receives
   * the raw event plus pre-computed scene coordinates so plugins can
   * skip viewport-to-scene math.
   *
   * Use cases: collab cursor broadcast, gesture telemetry, voice
   * annotation hover detection.
   *
   * Throws inside the observer are caught and console.error'd; one
   * buggy observer cannot break the editor's pointer pipeline.
   */
  onPointerEvent(
    type: PointerEventType,
    observer: PointerObserver,
  ): () => void;

  /**
   * Register a mutation filter. The filter runs BEFORE every gated
   * scene mutation; if any installed filter returns false (or
   * { allowed: false }), the mutation is blocked. Filters compose
   * AND-style: all must allow for the mutation to proceed.
   *
   * The host code that performs mutations checks `canMutate` at well-
   * defined gates (drag start, transform handle, delete action, etc.)
   * — not all internal mutation paths are filtered, by design. Filters
   * are NOT a security boundary; they are a UX coordination tool
   * (e.g. "student in classroom mode can only edit their assigned
   * frame"). Untrusted code paths must not rely on filters for
   * authorization.
   */
  addMutationFilter(filter: MutationFilter): () => void;

  /**
   * Register a callback that fires once after the editor is fully
   * mounted + the initial scene paint completed. If the callback
   * returns a function, that's a teardown closure called at plugin
   * uninstall (or editor unmount, whichever fires first).
   *
   * Plugins that auto-start side effects on mount (collab auto-join,
   * AI co-pilot pre-warm) should use this rather than a bare $effect
   * inside install — `install()` runs before the canvas is painted
   * and may race with scene initialization.
   */
  onEditorReady(cb: () => void | (() => void)): void;

  /**
   * Subscribe to a window-level event. The host owns the addEventListener
   * lifecycle; the dispose closure unregisters this plugin's callback
   * (the underlying window listener stays installed if other plugins
   * still observe the same type). Throws inside the observer are
   * caught + logged — one bad plugin can't break paste/drop for others.
   */
  onWindowEvent<T extends WindowEventType>(
    type: T,
    observer: (event: T extends "paste" ? ClipboardEvent
      : T extends "drop" | "dragover" ? DragEvent
      : T extends "beforeunload" ? BeforeUnloadEvent
      : Event) => void,
  ): () => void;

  /**
   * Per-element mutation observer. Fires once per affected element
   * after every gated mutation (drag, transform, style apply, scene
   * replace). Diff is computed by the host comparing snapshots before
   * + after; cheap when nothing changed.
   *
   * Fires `current=null` for deletes and `previous=null` for inserts;
   * both non-null for updates.
   */
  onElementChange<TElement = unknown>(
    observer: ElementChangeObserver<TElement>,
  ): () => void;

  /**
   * Register a tool plugin. The host routes pointerdown/move/up/cancel
   * to this tool when `appState.activeTool.type === def.name`.
   * Multiple registrations for the same name throw to surface
   * collisions early. Returns dispose closure.
   */
  registerTool(def: ToolPluginDef): () => void;

  /**
   * Publish a typed store under a Symbol key. Other plugins (or built-in
   * code) can fetch it later via getStore(key). Returns a cleanup that
   * unpublishes the store; the registry calls it automatically when the
   * plugin uninstalls.
   */
  provideStore<T>(key: symbol, store: T): () => void;

  /** Access a store published by this or another plugin. */
  getStore<T>(key: symbol): T | undefined;

  /**
   * Toggle one of this plugin's exclusive side panels. Pass the panel's
   * LOCAL id (the same string the plugin used in addSidePanel({id})) —
   * the context qualifies it with the plugin id internally. Returns
   * the new open state.
   */
  toggleExclusiveSidePanel(localPanelId: string): boolean;

  /** Close every exclusive side panel registry-wide. */
  closeAllExclusiveSidePanels(): void;

  onSceneChange: SveltedrawAPI["onChange"];
  onSelectionChange: SveltedrawAPI["onSelectionChange"];
  onToolChange: SveltedrawAPI["onToolChange"];
}

export interface SveltedrawPlugin {
  id: string;
  install(ctx: SveltedrawPluginContext): void | (() => void);
}
