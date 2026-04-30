// @sveltedraw/editor — Svelte 5 editor

export * from './components/index.js';
export * from './icons/index.js';

export { default as App } from './App.svelte';

// Public API surface for host apps and plugins
export { SVELTEDRAW_API_KEY } from './api/types.js';
export type { SveltedrawAPI } from './api/types.js';
export { PLUGIN_REGISTRY_KEY } from './plugins/registry.svelte.js';
export { PluginRegistry } from './plugins/registry.svelte.js';
export type {
  SveltedrawPlugin,
  SveltedrawPluginContext,
  ToolbarItemDef,
  SidePanelDef,
  CanvasOverlayDef,
  MainMenuItemDef,
} from './plugins/types.js';
export { examplePlugin } from './plugins/example/index.js';
export { builtinPlugins } from './plugins/builtin/index.js';
export { recentFilesPlugin, RECENT_FILES_STORE_KEY } from './plugins/builtin/recent-files/index.js';
export type { RecentFilesStore } from './plugins/builtin/recent-files/index.js';
export { settingsPlugin, SETTINGS_STORE_KEY } from './plugins/builtin/settings/index.js';
export type { SettingsStore } from './plugins/builtin/settings/index.js';
export { helpPlugin, HELP_STORE_KEY } from './plugins/builtin/help/index.js';
export type { HelpStore } from './plugins/builtin/help/index.js';
export { COLLAB_STORE_KEY } from './collab/store.svelte.js';
export { createCollabStore } from './collab/store.svelte.js';
export type { CollabStore, CollabRole, CollabUser } from './collab/store.svelte.js';
