// Built-in plugin: Command Palette.
//
// Demonstrates the post-ActionManager architecture end-to-end: the
// plugin owns nothing functional — it's a pure consumer of the
// ActionManager's registered set. Opens via Ctrl+Shift+P (registered
// here as a plugin Action), lists every enabled action, dispatches
// the picked one through `actionManager.execute(id)`. Adding a new
// command anywhere (core or another plugin) shows up automatically.

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import { createState } from "./state.svelte.js";
import PanelHost, { bindPanelHost } from "./PanelHost.svelte";
import CommandPaletteIcon from "./Icon.svelte";
import {
  ACTION_MANAGER_KEY,
  type ActionManager,
} from "../../../actions/index.js";

export const COMMAND_PALETTE_STORE_KEY: unique symbol =
  Symbol("commandPaletteStore");

export type CommandPaletteStore = {
  isOpen(): boolean;
  open(): void;
  close(): void;
  toggle(): void;
};

export const commandPalettePlugin: SveltedrawPlugin = {
  id: "builtin/command-palette",
  install(ctx: SveltedrawPluginContext): () => void {
    const state = createState();

    // The action manager is published on the host's context map,
    // not on the registry's stores Map (it's a host-owned singleton,
    // same shape as SVELTEDRAW_API_KEY). Plugin install runs after
    // App.svelte's synchronous init, so the manager is always
    // present here — getStore returns it via the bridgeGetStore
    // fallback.
    const actionManager = ctx.getStore<ActionManager>(ACTION_MANAGER_KEY);
    if (!actionManager) {
      throw new Error(
        "[plugin:command-palette] ActionManager not in context — host must publish ACTION_MANAGER_KEY before plugin install",
      );
    }

    bindPanelHost({ state, actionManager });

    const store: CommandPaletteStore = {
      isOpen: () => state.open,
      open: () => {
        state.searchTerm = "";
        state.open = true;
      },
      close: () => {
        state.open = false;
        state.searchTerm = "";
      },
      toggle: () => {
        state.open = !state.open;
        if (!state.open) state.searchTerm = "";
      },
    };
    const releaseStore = ctx.provideStore(COMMAND_PALETTE_STORE_KEY, store);

    const removeToolbarItem = ctx.addToolbarItem({
      id: "open",
      icon: CommandPaletteIcon,
      title: "Command palette (Ctrl+Shift+P)",
      group: "utility",
      isActive: () => state.open,
      onActivate: () => store.toggle(),
    });

    const removeSidePanel = ctx.addSidePanel({
      id: "panel",
      title: "Command palette",
      triggerIcon: CommandPaletteIcon,
      component: PanelHost,
      // The palette is a body-level modal (mounted via the side-panel
      // system to plug into the registry's iteration loop), not a
      // right-rail panel — same pattern Settings/Help/Templates use.
    });

    const removeAction = ctx.addAction({
      id: "open",
      label: "Open command palette",
      category: "plugin",
      hotkey: "CmdOrCtrl+Shift+P",
      perform: () => {
        store.open();
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
