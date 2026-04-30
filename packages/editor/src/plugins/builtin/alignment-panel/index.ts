// Built-in plugin: Alignment panel. Exclusive side panel.
//
// Owns: open/closed flag + toolbar button + side panel + plugin store.
// Reads handlers (align/distribute) and selection count through a
// bridge published by App.svelte (the editor keeps the canonical
// alignment factory because hotkey shortcuts call those handlers
// directly).

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import { createState } from "./state.svelte.js";
import { ALIGNMENT_BRIDGE_KEY, type AlignmentBridge } from "./bridge.js";
import PanelHost, { bindPanelHost } from "./PanelHost.svelte";
import AlignmentIcon from "./Icon.svelte";

export const ALIGNMENT_PANEL_STORE_KEY: unique symbol =
  Symbol("alignmentPanelStore");

export type AlignmentPanelStore = {
  open(): void;
  close(): void;
  toggle(): void;
};

export { ALIGNMENT_BRIDGE_KEY };
export type { AlignmentBridge };

export const alignmentPanelPlugin: SveltedrawPlugin = {
  id: "builtin/alignment-panel",
  install(ctx: SveltedrawPluginContext): () => void {
    const state = createState();
    const bridge = ctx.getStore<AlignmentBridge>(ALIGNMENT_BRIDGE_KEY) ?? null;
    bindPanelHost({ state, bridge });

    const store: AlignmentPanelStore = {
      open: () => {
        if (!state.open) ctx.toggleExclusiveSidePanel("panel");
      },
      close: () => (state.open = false),
      toggle: () => {
        ctx.toggleExclusiveSidePanel("panel");
      },
    };
    const releaseStore = ctx.provideStore(ALIGNMENT_PANEL_STORE_KEY, store);

    const removeToolbarItem = ctx.addToolbarItem({
      id: "open",
      icon: AlignmentIcon,
      title: "Alignment",
      group: "view",
      isActive: () => state.open,
      onActivate: () => store.toggle(),
    });

    const removeSidePanel = ctx.addSidePanel({
      id: "panel",
      title: "Alignment",
      triggerIcon: AlignmentIcon,
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
