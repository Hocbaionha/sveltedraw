// Bare-minimum localStorage persistence for the editor scene.
//
// JSON.stringify scene elements + a small AppState subset (zoom, scroll,
// viewBackgroundColor, theme, tool, selectedElementIds, gridModeEnabled)
// into a single key. Debounced saves (~500ms) so rapid mutations don't
// thrash storage.
//
// Schema versioning: SAVE_KEY includes `:v1`. Bump if the shape changes.
//
// Not ported from upstream:
//   - `restoreAppState` / `restoreElements` (defensive migration chains for
//     multi-year-old saved data). Our PoC is new; just read/write current shape.
//   - LocalData IndexedDB store (images + library). Lives elsewhere.

const SAVE_KEY = "sveltedraw:scene:v1";
const SAVE_DEBOUNCE_MS = 500;

// Scene is reassigned in onMount, so callers pass a getter — not the value.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SceneLike = { getElementsIncludingDeleted: () => any[]; replaceAllElements: (els: any[], opts?: any) => void };

export type PersistenceApi = {
  saveNow: () => void;
  scheduleSave: () => void;
  tryLoad: () => boolean;
  /** Cancel any pending debounced save and flush synchronously. */
  flushPendingSave: () => void;
};

export function createPersistence(opts: {
  getScene: () => SceneLike | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appState: any;
}): PersistenceApi {
  const { getScene, appState } = opts;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const pickPersistedAppState = () => ({
    zoom: appState.zoom,
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    viewBackgroundColor: appState.viewBackgroundColor,
    theme: appState.theme,
    activeTool: appState.activeTool,
    selectedElementIds: appState.selectedElementIds,
    gridModeEnabled: appState.gridModeEnabled,
  });

  const saveNow = () => {
    const scene = getScene();
    if (!scene || typeof localStorage === "undefined") return;
    try {
      const payload = {
        v: 1,
        elements: scene.getElementsIncludingDeleted(),
        appState: pickPersistedAppState(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch (err) {
      // Quota exceeded / private-mode Safari / disabled storage.
      // Log and move on — loss of persistence is better than a crash.
      // eslint-disable-next-line no-console
      console.warn("sveltedraw: save failed", err);
    }
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, SAVE_DEBOUNCE_MS);
  };

  const tryLoad = (): boolean => {
    const scene = getScene();
    if (!scene || typeof localStorage === "undefined") return false;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.elements)) return false;
      scene.replaceAllElements(parsed.elements, { skipValidation: true });
      // Shallow-merge appState subset. Any missing field falls back to
      // whatever is already there (e.g. width/height come from the live
      // container measure, not the saved snapshot).
      for (const [k, v] of Object.entries(parsed.appState ?? {})) {
        appState[k] = v;
      }
      return true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("sveltedraw: load failed", err);
      return false;
    }
  };

  const flushPendingSave = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      saveNow();
    }
  };

  return { saveNow, scheduleSave, tryLoad, flushPendingSave };
}
