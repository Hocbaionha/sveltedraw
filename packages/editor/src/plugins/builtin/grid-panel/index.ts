// Built-in plugin: Grid + Snap panel. Exclusive side panel.
//
// Configs (gridConfig, snapConfig) live in App.svelte because snap
// math runs inside the pointer-move drag handler — moving the configs
// out would require routing every drag event through the registry.
// Plugin owns the panel UI; reads/writes go through GridBridge.

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import { createState } from "./state.svelte.js";
import { GRID_BRIDGE_KEY, type GridBridge } from "./bridge.js";
import PanelHost, { bindPanelHost } from "./PanelHost.svelte";
import GridIcon from "./Icon.svelte";

export const GRID_PANEL_STORE_KEY: unique symbol = Symbol("gridPanelStore");

export type GridPanelStore = {
  open(): void;
  close(): void;
  toggle(): void;
};

export { GRID_BRIDGE_KEY };
export type { GridBridge };

export const gridPanelPlugin: SveltedrawPlugin = {
  id: "builtin/grid-panel",
  install(ctx: SveltedrawPluginContext): () => void {
    const state = createState();
    const bridge = ctx.getStore<GridBridge>(GRID_BRIDGE_KEY) ?? null;
    bindPanelHost({ state, bridge });

    const store: GridPanelStore = {
      open: () => {
        if (!state.open) ctx.toggleExclusiveSidePanel("panel");
      },
      close: () => (state.open = false),
      toggle: () => {
        ctx.toggleExclusiveSidePanel("panel");
      },
    };
    const releaseStore = ctx.provideStore(GRID_PANEL_STORE_KEY, store);

    const removeToolbarItem = ctx.addToolbarItem({
      id: "open",
      icon: GridIcon,
      title: "Grid & Snap",
      group: "view",
      isActive: () => state.open,
      onActivate: () => store.toggle(),
    });

    const removeSidePanel = ctx.addSidePanel({
      id: "panel",
      title: "Grid & Snap",
      triggerIcon: GridIcon,
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
