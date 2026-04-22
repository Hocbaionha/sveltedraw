// @sveltedraw/excalidraw — Svelte 5 port of @excalidraw/excalidraw
// Phase 3: leaf UI components added

export * from './components/index.js';
export * from './icons/index.js';

// Phase 6 batch 1: App.svelte shell (no event wiring yet — canvases mount
// with no-op handlers and a no-op renderer; call it to validate context
// plumbing, not to actually draw).
export { default as App } from './App.svelte';
