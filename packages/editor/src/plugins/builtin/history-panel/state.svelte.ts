// Plugin-local state for the History panel. Open/closed flag only —
// the actual history array + currentIndex live in App.svelte's
// historyStore (the editor owns the undo/redo source of truth).
// The plugin reads them through a published bridge.

export type HistoryPanelState = {
  open: boolean;
};

export function createState(): HistoryPanelState {
  const s: HistoryPanelState = $state({ open: false });
  return s;
}
