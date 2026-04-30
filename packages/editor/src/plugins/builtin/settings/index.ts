// Built-in plugin: Settings.
//
// Owns:
//   - localStorage persistence under "sveltedraw-settings"
//   - Defaults for theme / grid / autosave / undo history
//   - Toolbar button (utility group, "Settings" + Ctrl+, hint)
//   - Side panel mounting SettingsPanel
//   - Main menu item that opens the panel
//   - Apply settings to the host's appState (theme, grid visibility) on
//     load and on each change. The plugin reads/writes appState through
//     ctx.api.getAppState() / ctx.api.updateScene({ appState: ... }).

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import {
  createState,
  loadFromStorage,
  persistToStorage,
  type AppSettings,
} from "./state.svelte.js";
import PanelHost, { bindPanelHost } from "./PanelHost.svelte";
import SettingsIcon from "./Icon.svelte";

export const SETTINGS_STORE_KEY: unique symbol = Symbol("settingsStore");

export type SettingsStore = {
  /** Read the current settings snapshot. */
  get(): AppSettings;
  /** Open the settings panel. */
  open(): void;
};

export const settingsPlugin: SveltedrawPlugin = {
  id: "builtin/settings",
  install(ctx: SveltedrawPluginContext): () => void {
    const state = createState();
    loadFromStorage(state);

    /**
     * Push the current settings snapshot into the host's appState so
     * the canvas / theme classes pick them up. We use updateScene with
     * an appState patch — that's the only public API mutation path.
     */
    const applyToAppState = (s: AppSettings): void => {
      // The API's `updateScene({ appState })` patches one or more
      // appState fields. theme + gridModeEnabled are the two settings
      // that affect rendering today.
      const patch: Record<string, unknown> = {
        gridModeEnabled: s.gridVisible,
      };
      if (s.theme === "dark" || s.theme === "light") {
        patch.theme = s.theme;
      }
      ctx.api.updateScene({ appState: patch });
    };

    // Apply persisted settings on install so theme/grid reflect the
    // saved state from prior sessions.
    applyToAppState(state.values);

    const onChange = (next: AppSettings): void => {
      state.values = next;
      applyToAppState(next);
      persistToStorage(state);
    };

    bindPanelHost({ state, onChange });

    const store: SettingsStore = {
      get: () => state.values,
      open: () => (state.open = true),
    };
    const releaseStore = ctx.provideStore(SETTINGS_STORE_KEY, store);

    const removeToolbarItem = ctx.addToolbarItem({
      id: "open",
      icon: SettingsIcon,
      title: "Settings (Ctrl+,)",
      group: "utility",
      isActive: () => state.open,
      onActivate: () => (state.open = !state.open),
    });

    const removeSidePanel = ctx.addSidePanel({
      id: "panel",
      title: "Settings",
      triggerIcon: SettingsIcon,
      component: PanelHost,
    });

    const removeMenuItem = ctx.addMainMenuItem({
      id: "open",
      label: "Settings",
      shortcut: "Ctrl+,",
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
