// Built-in plugin: Help panel.
//
// Surfaces:
//   - Toolbar button (utility group, "Help (F1)")
//   - Side panel mounting HelpPanel
//   - Main menu item with F1 shortcut
//   - Provides HelpStore so the editor's F1 hotkey can open it

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import { createState } from "./state.svelte.js";
import PanelHost, { bindPanelHost } from "./PanelHost.svelte";
import HelpIcon from "./Icon.svelte";

export const HELP_STORE_KEY: unique symbol = Symbol("helpStore");

export type HelpStore = {
  open(): void;
};

export const helpPlugin: SveltedrawPlugin = {
  id: "builtin/help",
  install(ctx: SveltedrawPluginContext): () => void {
    const state = createState();
    bindPanelHost({ state });

    const store: HelpStore = {
      open: () => (state.open = true),
    };
    const releaseStore = ctx.provideStore(HELP_STORE_KEY, store);

    const removeToolbarItem = ctx.addToolbarItem({
      id: "open",
      icon: HelpIcon,
      title: "Help (F1)",
      group: "utility",
      isActive: () => state.open,
      onActivate: () => (state.open = !state.open),
    });

    const removeSidePanel = ctx.addSidePanel({
      id: "panel",
      title: "Help",
      triggerIcon: HelpIcon,
      component: PanelHost,
    });

    const removeMenuItem = ctx.addMainMenuItem({
      id: "open",
      label: "Keyboard shortcuts",
      shortcut: "F1",
      onSelect: () => (state.open = true),
    });

    return () => {
      releaseStore();
      removeToolbarItem();
      removeSidePanel();
      removeMenuItem();
    };
  },
};
