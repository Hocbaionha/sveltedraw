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

export function createImperativeAPI(
  engine: EngineDeps,
  contextResolver: (key: symbol) => unknown,
): SveltedrawAPI {
  const changeListeners = new Set<ChangeListener>();
  const selectionListeners = new Set<SelectionListener>();
  const toolListeners = new Set<ToolListener>();

  // Called by App.svelte whenever scene/appState mutates.
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

  const api: SveltedrawAPI = {
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
      const current = scene.getElementsIncludingDeleted();
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
      const remaining = scene
        .getElementsIncludingDeleted()
        .filter((el: AnyEl) => !idSet.has(el.id));
      scene.replaceAllElements(remaining, { skipValidation: true });
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

    async exportToBlob(opts) {
      // Delegated to export utilities — called with current scene snapshot.
      throw new Error("exportToBlob: wire engine.exportFns in App.svelte");
    },

    async exportToSvg(opts) {
      throw new Error("exportToSvg: wire engine.exportFns in App.svelte");
    },

    setActiveTool(tool) {
      engine.patchAppState({ activeTool: { type: tool } });
    },

    scrollToContent(opts) {
      // Noop stub — requires canvas-scroll helpers wired from App.svelte.
    },

    zoomToFit() {
      // Noop stub — requires renderer helpers wired from App.svelte.
    },

    getContext<T>(key: symbol): T {
      return contextResolver(key) as T;
    },
  };

  return Object.assign(api, { notifyChange, notifySelectionChange, notifyToolChange });
}

export type ImperativeAPIWithNotify = ReturnType<typeof createImperativeAPI>;
