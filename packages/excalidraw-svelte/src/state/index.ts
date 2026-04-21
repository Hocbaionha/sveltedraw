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
 * This replaces React's EditorInterfaceContext from components/App.tsx.
 * The value type is EditorInterface from @excalidraw/common.
 *
 * Usage:
 *   // provider (root Excalidraw component)
 *   import { setContext } from "svelte";
 *   import { EDITOR_INTERFACE_KEY } from "$state";
 *   setContext(EDITOR_INTERFACE_KEY, editorInterface);
 *
 *   // consumer
 *   import { getContext } from "svelte";
 *   import { EDITOR_INTERFACE_KEY } from "$state";
 *   import type { EditorInterface } from "@excalidraw/common";
 *   const editorInterface = getContext<EditorInterface>(EDITOR_INTERFACE_KEY);
 */
export const EDITOR_INTERFACE_KEY: unique symbol = Symbol("editorInterface");
