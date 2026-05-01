// Built-in plugin: Auto-Layout panel. Exclusive side panel.

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import { createState } from "./state.svelte.js";
import { AUTOLAYOUT_BRIDGE_KEY, type AutoLayoutBridge } from "./bridge.js";
import PanelHost, { bindPanelHost } from "./PanelHost.svelte";
import AutoLayoutIcon from "./Icon.svelte";

export const AUTOLAYOUT_PANEL_STORE_KEY: unique symbol =
  Symbol("autoLayoutPanelStore");

export type AutoLayoutPanelStore = {
  open(): void;
  close(): void;
  toggle(): void;
};

export { AUTOLAYOUT_BRIDGE_KEY };
export type { AutoLayoutBridge };

export const autoLayoutPanelPlugin: SveltedrawPlugin = {
  id: "builtin/autolayout-panel",
  install(ctx: SveltedrawPluginContext): () => void {
    const state = createState();
    const bridge = ctx.getStore<AutoLayoutBridge>(AUTOLAYOUT_BRIDGE_KEY) ?? null;
    bindPanelHost({ state, bridge });

    const store: AutoLayoutPanelStore = {
      open: () => {
        if (!state.open) ctx.toggleExclusiveSidePanel("panel");
      },
      close: () => (state.open = false),
      toggle: () => {
        ctx.toggleExclusiveSidePanel("panel");
      },
    };
    const releaseStore = ctx.provideStore(AUTOLAYOUT_PANEL_STORE_KEY, store);

    const removeToolbarItem = ctx.addToolbarItem({
      id: "open",
      icon: AutoLayoutIcon,
      title: "Auto Layout",
      group: "view",
      isActive: () => state.open,
      onActivate: () => store.toggle(),
    });

    const removeSidePanel = ctx.addSidePanel({
      id: "panel",
      title: "Auto Layout",
      triggerIcon: AutoLayoutIcon,
      component: PanelHost,
      exclusive: true,
      isOpen: () => state.open,
      setOpen: (v) => {
        state.open = v;
      },
    });

    const removeAction = ctx.addAction({
      id: "toggle",
      label: "Toggle auto-layout panel",
      category: "plugin",
      hotkey: "CmdOrCtrl+L",
      perform: () => {
        store.toggle();
        return { consumed: true };
      },
    });

    return () => {
      releaseStore();
      removeToolbarItem();
      removeSidePanel();
      removeAction();
    };
  },
};
