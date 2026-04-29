// @sveltedraw/excalidraw — Svelte 5 port of @sveltedraw/excalidraw

export * from './components/index.js';
export * from './icons/index.js';

export { default as App } from './App.svelte';

// Public API surface for host apps and plugins
export { SVELTEDRAW_API_KEY } from './api/types.js';
export type { SveltedrawAPI } from './api/types.js';
export { PLUGIN_REGISTRY_KEY } from './plugins/registry.svelte.js';
export { PluginRegistry } from './plugins/registry.svelte.js';
export type { SveltedrawPlugin, SveltedrawPluginContext, ToolbarItemDef, SidePanelDef, CanvasOverlayDef } from './plugins/types.js';
export { COLLAB_STORE_KEY } from './collab/store.svelte.js';
export { createCollabStore } from './collab/store.svelte.js';
export type { CollabStore, CollabRole, CollabUser } from './collab/store.svelte.js';
