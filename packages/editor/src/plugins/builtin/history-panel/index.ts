// Built-in plugin: History panel. First exclusive side-panel plugin —
// declares `exclusive: true` so the registry coordinates open/close
// with future side-panel plugins.
//
// The plugin owns the open/closed flag but reads the underlying
// reactive history arrays through HistoryUIBridge published by
// App.svelte (registerCtx(HISTORY_UI_BRIDGE_KEY, …)). That keeps the
// editor's undo/redo store as the single source of truth without
// forcing the plugin to take ownership.

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import { createState } from "./state.svelte.js";
import { HISTORY_UI_BRIDGE_KEY, type HistoryUIBridge } from "./bridge.js";
import PanelHost, { bindPanelHost } from "./PanelHost.svelte";
import HistoryIcon from "./Icon.svelte";

export const HISTORY_PANEL_STORE_KEY: unique symbol =
  Symbol("historyPanelStore");

export type HistoryPanelStore = {
  open(): void;
  close(): void;
  toggle(): void;
};

export { HISTORY_UI_BRIDGE_KEY };
export type { HistoryUIBridge };

export const historyPanelPlugin: SveltedrawPlugin = {
  id: "builtin/history-panel",
  install(ctx: SveltedrawPluginContext): () => void {
    const state = createState();
    // The bridge is published by App.svelte at editor mount. Resolves
    // through ctx.getStore which reads registry stores first then
    // falls through to Svelte context. Captured at install time —
    // App.svelte's bridge object stays the same identity for the
    // lifetime of the editor (its getters close over $state proxies).
    const bridge =
      ctx.getStore<HistoryUIBridge>(HISTORY_UI_BRIDGE_KEY) ?? null;

    bindPanelHost({ state, bridge });

    const store: HistoryPanelStore = {
      open: () => ctx.toggleExclusiveSidePanel("panel") || (state.open = true),
      close: () => (state.open = false),
      toggle: () => {
        // Delegate to the registry so opening this panel closes any
        // other exclusive side panels (when more get migrated).
        ctx.toggleExclusiveSidePanel("panel");
      },
    };
    const releaseStore = ctx.provideStore(HISTORY_PANEL_STORE_KEY, store);

    const removeToolbarItem = ctx.addToolbarItem({
      id: "open",
      icon: HistoryIcon,
      title: "History",
      group: "view",
      isActive: () => state.open,
      onActivate: () => store.toggle(),
    });

    const removeSidePanel = ctx.addSidePanel({
      id: "panel",
      title: "History",
      triggerIcon: HistoryIcon,
      component: PanelHost,
      exclusive: true,
      isOpen: () => state.open,
      setOpen: (v) => {
        state.open = v;
      },
    });

    return () => {
      releaseStore();
      removeToolbarItem();
      removeSidePanel();
    };
  },
};
