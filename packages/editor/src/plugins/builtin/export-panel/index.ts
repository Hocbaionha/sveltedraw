// Built-in plugin: Export panel.
//
// Tier 3 wave 3 — modal-overlay plugin. The plugin owns:
//   - active flag + ExportOptions + presets
//   - Panel mount (ExportPanel.svelte via PanelHost)
//   - EXPORT_STORE_KEY for App.svelte's UtilityBar onOpenExport hook
//     and the test probe surface
//
// App.svelte keeps the actual export pipeline (handleExport.ts wrapper
// closing over scene + appState + binaryFiles) and exposes it through
// EXPORT_BRIDGE_KEY. The plugin invokes bridge.doExport(opts, onComplete)
// when the user clicks Export — onComplete clears `active` so the modal
// closes after a successful save.

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import { createState } from "./state.svelte.js";
import { EXPORT_BRIDGE_KEY, type ExportBridge } from "./bridge.js";
import PanelHost, { bindPanelHost } from "./PanelHost.svelte";
import ExportIcon from "./Icon.svelte";

export const EXPORT_STORE_KEY: unique symbol = Symbol("exportPanelStore");

export type ExportPanelStore = {
  isOpen(): boolean;
  open(): void;
  close(): void;
  toggle(): void;
};

export { EXPORT_BRIDGE_KEY };
export type { ExportBridge };

export const exportPanelPlugin: SveltedrawPlugin = {
  id: "builtin/export-panel",
  install(ctx: SveltedrawPluginContext): () => void {
    const state = createState();
    const bridge = ctx.getStore<ExportBridge>(EXPORT_BRIDGE_KEY) ?? null;

    bindPanelHost({ state, bridge });

    const store: ExportPanelStore = {
      isOpen: () => state.active,
      open: () => {
        state.active = true;
      },
      close: () => {
        state.active = false;
      },
      toggle: () => {
        state.active = !state.active;
      },
    };
    const releaseStore = ctx.provideStore(EXPORT_STORE_KEY, store);

    const removeToolbarItem = ctx.addToolbarItem({
      id: "open",
      icon: ExportIcon,
      title: "Export",
      group: "utility",
      isActive: () => state.active,
      onActivate: () => store.toggle(),
    });

    // The Export panel is a body-level modal overlay, not a true side
    // panel — but registering it through addSidePanel is what plugs
    // the PanelHost into App.svelte's `pluginRegistry.sidePanels` loop
    // so the modal mounts when state.active flips. Same pattern as
    // Settings/Help/Templates.
    const removeSidePanel = ctx.addSidePanel({
      id: "panel",
      title: "Export",
      triggerIcon: ExportIcon,
      component: PanelHost,
    });

    return () => {
      releaseStore();
      removeToolbarItem();
      removeSidePanel();
    };
  },
};
