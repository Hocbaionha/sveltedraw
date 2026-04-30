// Built-in plugin: Shape Library panel. Exclusive side panel.
//
// libraryComponents + libraryCategories + librarySelectedCategory +
// librarySearchQuery + every handler stay in App.svelte. Plugin owns
// only the panel UI; reads/writes flow through ShapeLibraryBridge.

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import { createState } from "./state.svelte.js";
import {
  SHAPE_LIBRARY_BRIDGE_KEY,
  type ShapeLibraryBridge,
} from "./bridge.js";
import PanelHost, { bindPanelHost } from "./PanelHost.svelte";
import ShapeLibraryIcon from "./Icon.svelte";

export const SHAPE_LIBRARY_PANEL_STORE_KEY: unique symbol =
  Symbol("shapeLibraryPanelStore");

export type ShapeLibraryPanelStore = {
  open(): void;
  close(): void;
  toggle(): void;
};

export { SHAPE_LIBRARY_BRIDGE_KEY };
export type { ShapeLibraryBridge };

export const shapeLibraryPanelPlugin: SveltedrawPlugin = {
  id: "builtin/shape-library-panel",
  install(ctx: SveltedrawPluginContext): () => void {
    const state = createState();
    const bridge = ctx.getStore<ShapeLibraryBridge>(SHAPE_LIBRARY_BRIDGE_KEY) ?? null;
    bindPanelHost({ state, bridge });

    const store: ShapeLibraryPanelStore = {
      open: () => {
        if (!state.open) ctx.toggleExclusiveSidePanel("panel");
      },
      close: () => (state.open = false),
      toggle: () => {
        ctx.toggleExclusiveSidePanel("panel");
      },
    };
    const releaseStore = ctx.provideStore(SHAPE_LIBRARY_PANEL_STORE_KEY, store);

    const removeToolbarItem = ctx.addToolbarItem({
      id: "open",
      icon: ShapeLibraryIcon,
      title: "Shape Library",
      group: "view",
      isActive: () => state.open,
      onActivate: () => store.toggle(),
    });

    const removeSidePanel = ctx.addSidePanel({
      id: "panel",
      title: "Shape Library",
      triggerIcon: ShapeLibraryIcon,
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
