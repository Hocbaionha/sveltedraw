// Built-in plugin: Recent Files.
//
// Migrated out of App.svelte's inline state + UI. Owns:
//   - localStorage persistence under "sveltedraw-recent-files"
//   - 10-entry capped list, deduped by case-insensitive name
//   - Toolbar button (utility group, "Recent files" + Ctrl+R hint)
//   - Side panel mounting RecentFilesPanel
//   - Main menu item that opens the panel

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import {
  addFile,
  createState,
  deleteFile,
  loadFromStorage,
} from "./state.svelte.js";
import PanelHost, { bindPanelHost } from "./PanelHost.svelte";
import RecentFilesIcon from "./Icon.svelte";

/**
 * Public surface so other code can record file open/save events without
 * coupling to plugin internals. Resolved through PluginRegistry.getStore
 * so callers don't depend on the plugin's module shape.
 */
export const RECENT_FILES_STORE_KEY: unique symbol =
  Symbol("recentFilesStore");

export type RecentFilesStore = {
  /** Bump or insert a filename at the head of the recent list. */
  add(filename: string): void;
  /** Open the recent-files panel. */
  open(): void;
};

export const recentFilesPlugin: SveltedrawPlugin = {
  id: "builtin/recent-files",
  install(ctx: SveltedrawPluginContext): () => void {
    const state = createState();
    loadFromStorage(state);

    bindPanelHost({
      state,
      onDelete: (id) => deleteFile(state, id),
    });

    // Expose a small store object for other code to record file events.
    // Registered via the plugin registry's getStore mechanism so callers
    // (e.g. the file save/load handlers in App.svelte) can fetch it
    // without an import dependency on this plugin file.
    const store: RecentFilesStore = {
      add: (filename) => addFile(state, filename),
      open: () => (state.open = true),
    };
    // Publish through the registry so any code can fetch it via
    // PluginRegistry.getStore(RECENT_FILES_STORE_KEY) or
    // SveltedrawPluginContext.getStore — no import dependency on this
    // file. Released automatically by the registry on uninstall.
    const releaseStore = ctx.provideStore(RECENT_FILES_STORE_KEY, store);

    const removeToolbarItem = ctx.addToolbarItem({
      id: "open",
      icon: RecentFilesIcon,
      title: "Recent files (Ctrl+R)",
      group: "utility",
      isActive: () => state.open,
      onActivate: () => {
        state.open = !state.open;
      },
    });

    const removeSidePanel = ctx.addSidePanel({
      id: "panel",
      title: "Recent Files",
      triggerIcon: RecentFilesIcon,
      component: PanelHost,
    });

    const removeMenuItem = ctx.addMainMenuItem({
      id: "open",
      label: "Recent files",
      shortcut: "Ctrl+R",
      onSelect: () => {
        state.open = true;
      },
    });

    const removeAction = ctx.addAction({
      id: "open",
      label: "Recent files",
      category: "plugin",
      hotkey: "CmdOrCtrl+R",
      perform: () => {
        state.open = true;
        return { consumed: true };
      },
    });

    return () => {
      releaseStore();
      removeToolbarItem();
      removeSidePanel();
      removeMenuItem();
      removeAction();
    };
  },
};
