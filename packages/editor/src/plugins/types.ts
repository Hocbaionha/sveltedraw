// Plugin system types. A SveltedrawPlugin is the unit of OCP extension:
// adding a feature = dropping a plugin file, zero modifications to App.svelte.

import type { Component, Snippet } from "svelte";
import type { SveltedrawAPI } from "../api/types.js";
import type { TunnelsContext } from "../state/tunnels.svelte.js";

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
   * Publish a typed store under a Symbol key. Other plugins (or built-in
   * code) can fetch it later via getStore(key). Returns a cleanup that
   * unpublishes the store; the registry calls it automatically when the
   * plugin uninstalls.
   */
  provideStore<T>(key: symbol, store: T): () => void;

  /** Access a store published by this or another plugin. */
  getStore<T>(key: symbol): T | undefined;

  onSceneChange: SveltedrawAPI["onChange"];
  onSelectionChange: SveltedrawAPI["onSelectionChange"];
  onToolChange: SveltedrawAPI["onToolChange"];
}

export interface SveltedrawPlugin {
  id: string;
  install(ctx: SveltedrawPluginContext): void | (() => void);
}
