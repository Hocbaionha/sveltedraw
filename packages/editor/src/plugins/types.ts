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
