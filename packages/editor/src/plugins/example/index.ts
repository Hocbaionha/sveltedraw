// Example plugin — demonstrates every PluginRegistry surface end-to-end.
// Useful both as a smoke-test for the OCP refactor and as a template
// for real third-party plugins.
//
// Surfaces exercised:
//   - addToolbarItem (utility group, with isActive + onActivate)
//   - addSidePanel   (component reference; the panel reads plugin-local
//                    state through a module-level binding to avoid
//                    forcing every plugin author to write a custom
//                    .svelte wrapper)
//   - addMainMenuItem
//   - subscribes to api.onChange for live element-count display
//
// Plugin contract is intentionally tiny: { id, install(ctx) → cleanup }.

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../types.js";
import { createPluginState } from "./state.svelte.js";
import { bindPalettePanel } from "./PalettePanel.svelte";
import PalettePanel from "./PalettePanel.svelte";
import PaletteIcon from "./Icon.svelte";

export const examplePlugin: SveltedrawPlugin = {
  id: "example",
  install(ctx: SveltedrawPluginContext): () => void {
    const state = createPluginState();

    // Seed the element count + subscribe so it stays fresh as the user
    // draws. The unsubscribe is part of the cleanup return.
    state.elementsCount = ctx.api.getElements().length;
    const offChange = ctx.onSceneChange((elements) => {
      state.elementsCount = elements.length;
    });

    // Bind the panel's module-level singleton before registering so the
    // first render of PalettePanel finds non-null bindings.
    bindPalettePanel({
      state,
      onPing: () => {
        // Demo: show the plugin can read appState / call API. Real
        // plugins would do something visible (toast, scroll-to,
        // open another panel, etc.).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tool = (ctx.api.getAppState() as any).activeTool;
        // eslint-disable-next-line no-console
        console.log("[example-plugin] ping! Active tool:", tool);
      },
      onClearScene: () => {
        if (window.confirm("Clear the canvas? (example plugin)")) {
          ctx.api.resetScene();
        }
      },
    });

    const removeToolbarItem = ctx.addToolbarItem({
      id: "toggle-palette",
      icon: PaletteIcon,
      title: "Example plugin: toggle palette",
      group: "utility",
      isActive: () => state.open,
      onActivate: () => {
        state.open = !state.open;
      },
    });

    const removeSidePanel = ctx.addSidePanel({
      id: "palette",
      title: "Example plugin",
      triggerIcon: PaletteIcon,
      component: PalettePanel,
    });

    const removeMenuItem = ctx.addMainMenuItem({
      id: "open-palette",
      label: "Open example plugin palette",
      onSelect: () => {
        state.open = true;
      },
    });

    return () => {
      offChange();
      removeToolbarItem();
      removeSidePanel();
      removeMenuItem();
    };
  },
};
