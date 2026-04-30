// Snapshot-based undo/redo store. Extracted from App.svelte (Phase 6 batch 5).
//
// Why snapshot-based, not delta-based: original's History class is tightly
// coupled to Store / StoreSnapshot / CaptureUpdateAction; porting that
// machinery is out-of-scope for the PoC. Snapshots hold a deep clone of every
// element + a copy of selectedElementIds. Memory cost is O(entry-count ×
// scene-size), capped by MAX_HISTORY (default 500). Delta snapshots are
// emitted between full ones when smaller, reducing the long-run footprint.
//
// INVARIANT: `history[historyIndex]` always equals the CURRENT scene state.
// - Push an initial snapshot on mount (empty scene → history=[empty]).
// - After ANY durable mutation, call `pushHistory()` to record the NEW state.
//   Truncates the redo tail (history.length = historyIndex + 1 + new).
// - `undo()`: if index > 0, dec, apply history[index].
// - `redo()`: if index < length-1, inc, apply history[index].
//
// For gestures (drag, in-progress draw), don't record mid-flight frames:
// wait until pointerup/commit then push ONE entry.

// @ts-ignore
import { deepCopyElement } from "@sveltedraw/element";
import type { HistoryState } from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEl = any;

type SceneLike = {
  getElementsIncludingDeleted: () => AnyEl[];
  replaceAllElements: (els: AnyEl[], opts?: { skipValidation?: boolean }) => void;
};

export type HistorySnapshot = {
  // Full snapshot (used as base or when delta is larger)
  full?: {
    elements: AnyEl[];
    selectedElementIds: Record<string, true>;
  };
  // Delta snapshot (only changes from previous)
  delta?: {
    added: AnyEl[];
    modified: Array<{ id: string; changes: Record<string, AnyEl> }>;
    removed: string[];
    // Selection at capture time. Lives on delta too (not just full) so
    // undo/redo can restore selection correctly when landing on a delta.
    selectedElementIds: Record<string, true>;
  };
  timestamp: number;
};

export type HistoryStoreOptions = {
  getScene: () => SceneLike | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appState: any;
  scheduleSave: () => void;
  bumpSceneRepaint: () => void;
  /** Push the current entries + index back to App.svelte $state for the panel. */
  setUI: (entries: HistoryState[], currentIndex: number) => void;
  /** Cap on history length. Defaults to 500. */
  maxHistory?: number;
};

export type HistoryStore = {
  /** Snapshot the current scene + push as new head. Truncates redo tail. */
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  /** Jump to a specific entry index (validated). */
  jumpTo: (index: number) => void;
  /** Wipe the stack but keep the current scene as the sole entry. */
  clearKeepCurrent: () => void;
  /** Test/debug accessor for the raw stack length. */
  getLength: () => number;
};

export function createHistoryStore(opts: HistoryStoreOptions): HistoryStore {
  const {
    getScene,
    appState,
    scheduleSave,
    bumpSceneRepaint,
    setUI,
    maxHistory = 500,
  } = opts;

  const history: HistorySnapshot[] = [];
  let historyIndex = -1;

  // Deep equality check for elements (used in delta computation)
  const elementsEqual = (a: AnyEl, b: AnyEl): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (a[key] !== b[key]) {
        if (Array.isArray(a[key]) && Array.isArray(b[key])) {
          if (a[key].length !== b[key].length) return false;
          if (!a[key].every((v: AnyEl, i: number) => v === b[key][i])) return false;
        } else {
          return false;
        }
      }
    }
    return true;
  };

  const computeDelta = (prevElements: AnyEl[], currElements: AnyEl[]) => {
    // Index prevElements by id once. The previous implementation did
    // .find(el => el.id === e.id) per-element TWICE inside the
    // filter+map chain — O(N²) on scenes where most elements were
    // modified.
    const prevById = new Map<string, AnyEl>();
    for (const el of prevElements) prevById.set(el.id, el);
    const currIds = new Set<string>();
    for (const e of currElements) currIds.add(e.id);

    const added: AnyEl[] = [];
    const modified: { id: string; changes: Record<string, AnyEl> }[] = [];
    for (const e of currElements) {
      const prevEl = prevById.get(e.id);
      if (!prevEl) {
        added.push(deepCopyElement(e));
        continue;
      }
      if (elementsEqual(prevEl, e)) continue;
      const changes: Record<string, AnyEl> = {};
      const keys = new Set([...Object.keys(prevEl), ...Object.keys(e)]);
      for (const key of keys) {
        if (prevEl[key] !== e[key]) changes[key] = e[key];
      }
      modified.push({ id: e.id, changes });
    }

    const removed: string[] = [];
    for (const [id] of prevById) {
      if (!currIds.has(id)) removed.push(id);
    }

    return { added, modified, removed };
  };

  const captureSnapshot = (): HistorySnapshot => {
    const scene = getScene();
    const els = scene?.getElementsIncludingDeleted() ?? [];
    const current = {
      elements: els.map((el: AnyEl) => deepCopyElement(el)),
      selectedElementIds: { ...(appState.selectedElementIds ?? {}) },
    };

    const timestamp = Date.now();

    if (history.length === 0) {
      return { full: current, timestamp };
    }

    const prevFull = history
      .slice(0, historyIndex + 1)
      .reverse()
      .find((h) => h.full);

    if (prevFull?.full) {
      const delta = computeDelta(prevFull.full.elements, current.elements);
      const deltaWithSel = {
        ...delta,
        selectedElementIds: current.selectedElementIds,
      };
      const deltaSize = JSON.stringify(deltaWithSel).length;
      const fullSize = JSON.stringify(current).length;
      if (deltaSize < fullSize * 0.8) {
        return { delta: deltaWithSel, timestamp };
      }
    }

    return { full: current, timestamp };
  };

  // Sync the reactive HistoryPanel view from the non-reactive history[] array.
  // elementCount is approximated as the latest known count — exact per-snapshot
  // counts would require delta replay.
  const syncHistoryUI = () => {
    let lastCount = 0;
    const entries: HistoryState[] = history.map((snap, i) => {
      let count = lastCount;
      if (snap.full) {
        count = snap.full.elements.length;
      } else if (snap.delta) {
        count = lastCount + snap.delta.added.length - snap.delta.removed.length;
      }
      lastCount = count;
      let description = "Change";
      if (i === 0) description = "Initial state";
      else if (snap.full) description = "Snapshot";
      else if (snap.delta) {
        const d = snap.delta;
        const parts: string[] = [];
        if (d.added.length) parts.push(`+${d.added.length}`);
        if (d.removed.length) parts.push(`-${d.removed.length}`);
        if (d.modified.length) parts.push(`~${d.modified.length}`);
        description = parts.join(" ") || "Change";
      }
      return {
        id: `h-${i}-${snap.timestamp}`,
        timestamp: snap.timestamp,
        description,
        elementCount: count,
        previewDataUrl: undefined,
      };
    });
    setUI(entries, historyIndex);
  };

  const applySnapshot = (snap: HistorySnapshot) => {
    const scene = getScene();
    if (!scene) return;

    let elements: AnyEl[];
    let selectedElementIds: Record<string, true>;

    if (snap.full) {
      elements = snap.full.elements.map((el: AnyEl) => deepCopyElement(el));
      selectedElementIds = { ...snap.full.selectedElementIds };
    } else if (snap.delta) {
      const snapIdx = history.indexOf(snap);
      const prevFull = history
        .slice(0, snapIdx + 1)
        .reverse()
        .find((h) => h.full);

      if (!prevFull?.full) {
        // eslint-disable-next-line no-console
        console.error("No base snapshot found for delta reconstruction");
        return;
      }

      elements = prevFull.full.elements.map((el: AnyEl) => deepCopyElement(el));

      const startIdx = history.indexOf(prevFull) + 1;
      for (let i = startIdx; i <= snapIdx; i++) {
        const deltaSnap = history[i];
        if (deltaSnap.delta) {
          elements = elements.filter(
            (e: AnyEl) => !deltaSnap.delta!.removed.includes(e.id),
          );
          elements.push(
            ...deltaSnap.delta.added.map((el: AnyEl) => deepCopyElement(el)),
          );
          for (const { id, changes } of deltaSnap.delta.modified) {
            const el = elements.find((e: AnyEl) => e.id === id);
            if (el) Object.assign(el, changes);
          }
        }
      }

      // Deltas now carry their own selectedElementIds (captured at push
      // time). Fall back to {} for snapshots from older sessions that
      // predate this field.
      selectedElementIds = { ...(snap.delta.selectedElementIds ?? {}) };
    } else {
      // eslint-disable-next-line no-console
      console.error("Invalid snapshot: no full or delta");
      return;
    }

    scene.replaceAllElements(elements, { skipValidation: true });
    appState.selectedElementIds = selectedElementIds;
    bumpSceneRepaint();
  };

  const pushHistory = () => {
    const snap = captureSnapshot();
    history.length = historyIndex + 1;
    history.push(snap);
    historyIndex = history.length - 1;
    while (history.length > maxHistory) {
      history.shift();
      historyIndex--;
    }
    // Note: Phase 10 had a direct ymap.set("elements", elements) call
    // here for collab broadcast. That path is now dead (App.svelte
    // wires getYmap → null) and routing collab through here would
    // bypass the collab store's LOCAL_ORIGIN guard, fingerprint
    // dedupe, and clone-on-push — corrupting peer state. Collab
    // broadcast is owned by collab/store.svelte.ts (api.onChange →
    // scheduleLocalPush). Removed the dead branch so a future re-
    // enable can't unwittingly hit the bug.
    scheduleSave();
    syncHistoryUI();
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    historyIndex--;
    applySnapshot(history[historyIndex]);
    syncHistoryUI();
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    applySnapshot(history[historyIndex]);
    syncHistoryUI();
  };

  const jumpTo = (index: number) => {
    if (index < 0 || index >= history.length) return;
    historyIndex = index;
    applySnapshot(history[index]);
    syncHistoryUI();
  };

  const clearKeepCurrent = () => {
    const current = captureSnapshot();
    history.length = 0;
    history.push(current);
    historyIndex = 0;
    syncHistoryUI();
  };

  return {
    pushHistory,
    undo,
    redo,
    jumpTo,
    clearKeepCurrent,
    getLength: () => history.length,
  };
}
