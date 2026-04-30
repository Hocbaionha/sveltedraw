// Built-in plugin: Layer panel. Exclusive side panel.
//
// layers + selectedLayerId + every handler stays in App.svelte —
// the layer factory needs scene + appState + pushHistory +
// bumpSceneRepaint, all editor-owned. Plugin owns the panel UI
// + toolbar trigger; reads/writes flow through LayerBridge.

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import { createState } from "./state.svelte.js";
import { LAYER_BRIDGE_KEY, type LayerBridge } from "./bridge.js";
import PanelHost, { bindPanelHost } from "./PanelHost.svelte";
import LayerIcon from "./Icon.svelte";

export const LAYER_PANEL_STORE_KEY: unique symbol = Symbol("layerPanelStore");

export type LayerPanelStore = {
  open(): void;
  close(): void;
  toggle(): void;
};

export { LAYER_BRIDGE_KEY };
export type { LayerBridge };

export const layerPanelPlugin: SveltedrawPlugin = {
  id: "builtin/layer-panel",
  install(ctx: SveltedrawPluginContext): () => void {
    const state = createState();
    const bridge = ctx.getStore<LayerBridge>(LAYER_BRIDGE_KEY) ?? null;
    bindPanelHost({ state, bridge });

    const store: LayerPanelStore = {
      open: () => {
        if (!state.open) ctx.toggleExclusiveSidePanel("panel");
      },
      close: () => (state.open = false),
      toggle: () => {
        ctx.toggleExclusiveSidePanel("panel");
      },
    };
    const releaseStore = ctx.provideStore(LAYER_PANEL_STORE_KEY, store);

    const removeToolbarItem = ctx.addToolbarItem({
      id: "open",
      icon: LayerIcon,
      title: "Layers",
      group: "view",
      isActive: () => state.open,
      onActivate: () => store.toggle(),
    });

    const removeSidePanel = ctx.addSidePanel({
      id: "panel",
      title: "Layers",
      triggerIcon: LayerIcon,
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
