// Bare-minimum localStorage persistence for the editor scene.
//
// JSON.stringify scene elements + a small AppState subset (zoom, scroll,
// viewBackgroundColor, theme, tool, selectedElementIds, gridModeEnabled)
// into a single key. Debounced saves (~500ms) so rapid mutations don't
// thrash storage.
//
// Schema versioning: SAVE_KEY includes `:v1`. Bump if the shape changes.
//
// Not ported from the engine:
//   - `restoreAppState` / `restoreElements` (defensive migration chains for
//     multi-year-old saved data). Our PoC is new; just read/write current shape.
//   - LocalData IndexedDB store (images + library). Lives elsewhere.

const SAVE_KEY = "sveltedraw:scene:v1";
const SAVE_SCHEMA_VERSION = 1;
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
  /** Cancel any pending debounced save WITHOUT flushing. Used by the
   *  plugin teardown path so an uninstall doesn't fire one last save
   *  against scene state the host might be tearing down concurrently. */
  dispose: () => void;
};

/**
 * Stand-alone load — used by the bootstrap path before the persistence
 * plugin is installed. Extracted from createPersistence so the host
 * doesn't have to spin up a full persistence instance just to read
 * the saved snapshot once on mount.
 */
export function loadPersistedScene(opts: {
  getScene: () => SceneLike | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appState: any;
}): boolean {
  const { getScene, appState } = opts;
  const scene = getScene();
  if (!scene || typeof localStorage === "undefined") return false;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.elements)) return false;
    if (parsed.v !== SAVE_SCHEMA_VERSION) {
      // eslint-disable-next-line no-console
      console.warn(
        `sveltedraw: persisted scene schema v${parsed.v} does not match expected v${SAVE_SCHEMA_VERSION} — skipping load. Old data is left in place; clear localStorage["${SAVE_KEY}"] to remove it.`,
      );
      return false;
    }
    scene.replaceAllElements(parsed.elements, { skipValidation: true });
    for (const [k, v] of Object.entries(parsed.appState ?? {})) {
      // activeTool is skipped explicitly: older saves persisted it,
      // but restoring it here would bypass setActiveTool → plugin
      // tools never get their onActivate fired (and a plugin since
      // uninstalled would leave the editor in an unreachable tool
      // state).
      //
      // __proto__ / constructor / prototype: defensive skip for
      // prototype-pollution. The attacker would need to have
      // already written attacker-controlled JSON into the user's
      // own localStorage (low surface), but the engine's $state
      // proxy doesn't gate these, and overwriting `constructor`
      // breaks instanceof checks downstream. One-line skip is
      // cheaper than auditing every consumer.
      if (
        k === "activeTool" ||
        k === "__proto__" ||
        k === "constructor" ||
        k === "prototype"
      ) {
        continue;
      }
      appState[k] = v;
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("sveltedraw: load failed", err);
    return false;
  }
}

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
    // activeTool is intentionally NOT persisted: restoring it via
    // shallow merge bypasses setActiveTool → plugin tools never get
    // their onActivate fired, and a plugin tool that's been
    // uninstalled since the save would leave the editor in an
    // inactive-tool dead state. Defaulting to the editor's
    // initial-state activeTool (selection) on every reload is also
    // the more useful UX.
    selectedElementIds: appState.selectedElementIds,
    gridModeEnabled: appState.gridModeEnabled,
  });

  let disposed = false;

  const saveNow = () => {
    if (disposed) return;
    const scene = getScene();
    if (!scene || typeof localStorage === "undefined") return;
    try {
      const payload = {
        v: SAVE_SCHEMA_VERSION,
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
    if (disposed) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, SAVE_DEBOUNCE_MS);
  };

  const tryLoad = (): boolean => loadPersistedScene({ getScene, appState });

  const flushPendingSave = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      if (!disposed) saveNow();
    }
  };

  const dispose = () => {
    disposed = true;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  };

  return { saveNow, scheduleSave, tryLoad, flushPendingSave, dispose };
}
