export { createEditorStore } from "./editorStore.svelte.js";
export type { EditorStore } from "./editorStore.svelte.js";

export { createAppStore } from "./appStore.svelte.js";
export type { AppStore } from "./appStore.svelte.js";

/**
 * Svelte context key for the per-editor store.
 * Usage:
 *   // root Excalidraw component (provider)
 *   import { setContext } from "svelte";
 *   import { EDITOR_STORE_KEY, createEditorStore } from "$state";
 *   setContext(EDITOR_STORE_KEY, createEditorStore());
 *
 *   // any descendant component (consumer)
 *   import { getContext } from "svelte";
 *   import { EDITOR_STORE_KEY } from "$state";
 *   import type { EditorStore } from "$state";
 *   const editorStore = getContext<EditorStore>(EDITOR_STORE_KEY);
 */
export const EDITOR_STORE_KEY: unique symbol = Symbol("editorStore");

/**
 * Svelte context key for the app-wide store.
 * Provided once at the application root, shared across all editors on the page.
 */
export const APP_STORE_KEY: unique symbol = Symbol("appStore");

/**
 * Svelte context key for EditorInterface (formFactor, desktopUIMode, …).
 * Value type is EditorInterface from @sveltedraw/common.
 */
export const EDITOR_INTERFACE_KEY: unique symbol = Symbol("editorInterface");

/**
 * Svelte context key for the per-editor container id, used to namespace
 * radio-input names and similar IDs scoped to a single Excalidraw instance.
 * Optional — components fall back to a generated id when not provided.
 */
export const EXCAL_ID_KEY: unique symbol = Symbol("excalId");

// Tunnels (port of packages/excalidraw/context/tunnels.ts)
export {
  Tunnel,
  FallbackCounter,
  TunnelsContext,
  createTunnelsContext,
  TUNNELS_KEY,
} from "./tunnels.svelte.js";
export type { TunnelEntry } from "./tunnels.svelte.js";

// OverwriteConfirm store (port of OverwriteConfirmState.ts jotai atom)
export {
  OverwriteConfirmStore,
  overwriteConfirmStore,
} from "./overwriteConfirmState.svelte.js";
export type {
  OverwriteConfirmActiveState,
  OverwriteConfirmInactiveState,
  OverwriteConfirmStateValue,
} from "./overwriteConfirmState.svelte.js";

// ColorPicker section store (port of activeColorPickerSectionAtom)
export {
  ColorPickerSectionStore,
  colorPickerSectionStore,
} from "./colorPickerState.svelte.js";
export type { ActiveColorPickerSection } from "./colorPickerState.svelte.js";

// localStorage scene persistence (debounced save / load)
export { createPersistence } from "./persistence.js";
export type { PersistenceApi } from "./persistence.js";
