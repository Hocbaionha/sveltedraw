// ImperativeAPI — concrete implementation of SveltedrawAPI.
// Constructed by App.svelte and provided via setContext(SVELTEDRAW_API_KEY).
// Host apps receive it through the `onmount` prop callback.

import type { EngineDeps, SceneLike } from "../engine/deps.js";
import type { SveltedrawAPI } from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEl = any;

type ChangeListener = (
  elements: readonly AnyEl[],
  appState: Record<string, unknown>,
) => void;
type SelectionListener = (selected: readonly AnyEl[]) => void;
type ToolListener = (tool: string) => void;

/** Internal extension of SveltedrawAPI — not part of the public surface. */
export interface ImperativeAPIWithNotify extends SveltedrawAPI {
  notifyChange(): void;
  notifySelectionChange(selected: readonly AnyEl[]): void;
  notifyToolChange(tool: string): void;
}

export function createImperativeAPI(
  engine: EngineDeps,
  contextResolver: <T>(key: symbol) => T,
): ImperativeAPIWithNotify {
  const changeListeners = new Set<ChangeListener>();
  const selectionListeners = new Set<SelectionListener>();
  const toolListeners = new Set<ToolListener>();

  const notifyChange = () => {
    if (changeListeners.size === 0) return;
    const scene = engine.getScene();
    const elements = scene?.getNonDeletedElements() ?? [];
    const appState = engine.getAppState();
    for (const cb of changeListeners) cb(elements, appState);
  };

  const notifySelectionChange = (selected: readonly AnyEl[]) => {
    for (const cb of selectionListeners) cb(selected);
  };

  const notifyToolChange = (tool: string) => {
    for (const cb of toolListeners) cb(tool);
  };

  const api: ImperativeAPIWithNotify = {
    getElements() {
      return engine.getScene()?.getNonDeletedElements() ?? [];
    },

    getAppState() {
      return engine.getAppState() as Record<string, unknown>;
    },

    getSelectedElements() {
      const appState = engine.getAppState();
      const selected = appState.selectedElementIds as Record<string, boolean> | undefined;
      if (!selected) return [];
      const scene = engine.getScene();
      return (scene?.getNonDeletedElements() ?? []).filter(
        (el: AnyEl) => selected[el.id],
      );
    },

    updateScene({ elements, appState }) {
      const scene = engine.getScene() as SceneLike | null;
      if (elements && scene) {
        scene.replaceAllElements(elements, { skipValidation: true });
      }
      if (appState) {
        engine.patchAppState(appState);
      }
      engine.pushHistory();
      engine.bumpSceneRepaint();
    },

    addElements(elements) {
      const scene = engine.getScene() as SceneLike | null;
      if (!scene) return;
      // Build on non-deleted elements only — including deleted ones would
      // resurrect soft-deleted history entries.
      const current = scene.getNonDeletedElements();
      scene.replaceAllElements([...current, ...elements], { skipValidation: true });
      engine.pushHistory();
      engine.bumpSceneRepaint();
    },

    updateElement(id, patch) {
      const scene = engine.getScene() as SceneLike | null;
      if (!scene) return;
      const el = scene.getElementById(id);
      if (!el) return;
      Object.assign(el, patch);
      engine.pushHistory();
      engine.bumpSceneRepaint();
    },

    deleteElements(ids) {
      const scene = engine.getScene() as SceneLike | null;
      if (!scene) return;
      const idSet = new Set(ids);
      // Soft-delete: mark isDeleted=true so undo/redo history stays intact.
      for (const el of scene.getNonDeletedElements()) {
        if (idSet.has(el.id)) {
          el.isDeleted = true;
        }
      }
      engine.pushHistory();
      engine.bumpSceneRepaint();
    },

    resetScene() {
      const scene = engine.getScene() as SceneLike | null;
      if (!scene) return;
      scene.replaceAllElements([], { skipValidation: true });
      engine.pushHistory();
      engine.bumpSceneRepaint();
    },

    onChange(cb) {
      changeListeners.add(cb);
      return () => changeListeners.delete(cb);
    },

    onSelectionChange(cb) {
      selectionListeners.add(cb);
      return () => selectionListeners.delete(cb);
    },

    onToolChange(cb) {
      toolListeners.add(cb);
      return () => toolListeners.delete(cb);
    },

    async exportToBlob(_opts) {
      throw new Error("exportToBlob: not yet wired — pass exportFns via EngineDeps");
    },

    async exportToSvg(_opts) {
      throw new Error("exportToSvg: not yet wired — pass exportFns via EngineDeps");
    },

    setActiveTool(tool) {
      engine.setActiveTool(tool);
    },

    scrollToContent(_opts) {
      // Stub — requires canvas-scroll helpers to be wired from App.svelte.
    },

    zoomToFit() {
      // Stub — requires renderer helpers to be wired from App.svelte.
    },

    getContext<T>(key: symbol): T {
      return contextResolver<T>(key);
    },

    notifyChange,
    notifySelectionChange,
    notifyToolChange,
  };

  return api;
}
