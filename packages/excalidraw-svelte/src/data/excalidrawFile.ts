// Save/load the scene as a .excalidraw JSON file (the canonical Excalidraw
// interchange format). Wraps the upstream-shaped envelope but does not call
// `restoreElements` defensively — the loader bails on missing/invalid arrays
// rather than migrating older shapes.

import { triggerDownload } from "./download.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEl = any;
type SceneLike = {
  getNonDeletedElements: () => AnyEl[];
  replaceAllElements: (els: AnyEl[], opts?: { skipValidation?: boolean }) => void;
};

export const saveAsExcalidrawFile = async (opts: {
  scene: SceneLike | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appState: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  binaryFiles: Record<string, any>;
}): Promise<void> => {
  const { scene, appState, binaryFiles } = opts;
  if (!scene) return;
  const elements = scene.getNonDeletedElements();
  const json = JSON.stringify(
    {
      type: "excalidraw",
      version: 2,
      source: window.location.origin,
      elements,
      appState: {
        gridSize: appState.gridSize,
        gridStep: appState.gridStep,
        gridModeEnabled: appState.gridModeEnabled,
        viewBackgroundColor: appState.viewBackgroundColor,
        theme: appState.theme,
      },
      files: binaryFiles,
    },
    null,
    2,
  );
  const blob = new Blob([json], { type: "application/vnd.excalidraw+json" });
  const name = appState.name || "sveltedraw";
  triggerDownload(blob, `${name}.excalidraw`);
};

export const openExcalidrawFilePicker = (opts: {
  scene: SceneLike | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appState: any;
  clearSelection: () => void;
  pushHistory: () => void;
  bumpSceneRepaint: () => void;
}): void => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".excalidraw,application/json,application/vnd.excalidraw+json";
  input.onchange = async () => {
    const file = input.files?.[0];
    const { scene, appState, clearSelection, pushHistory, bumpSceneRepaint } = opts;
    if (!file || !scene) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.elements)) {
        throw new Error("Invalid .excalidraw file");
      }
      scene.replaceAllElements(parsed.elements, { skipValidation: true });
      if (parsed.appState) {
        for (const key of ["viewBackgroundColor", "theme", "gridModeEnabled"]) {
          if (parsed.appState[key] !== undefined) {
            appState[key] = parsed.appState[key];
          }
        }
      }
      clearSelection();
      pushHistory();
      bumpSceneRepaint();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("sveltedraw: failed to load file", err);
      window.alert("Failed to load .excalidraw file");
    }
  };
  input.click();
};
