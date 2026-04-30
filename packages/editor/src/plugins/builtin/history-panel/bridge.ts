// Bridge contract that the editor publishes via setContext so the
// HistoryPanel plugin can read the reactive history arrays without
// taking ownership of the undo/redo store. App.svelte declares the
// bridge with getters that close over its $state proxies; the plugin
// reads via getters so Svelte's reactivity tracks the underlying
// assignments.

import type { HistoryState } from "../../../history/types.js";

export const HISTORY_UI_BRIDGE_KEY: unique symbol =
  Symbol("historyUIBridge");

export type HistoryUIBridge = {
  /** Reactive: latest snapshot of editor history entries. */
  readonly history: readonly HistoryState[];
  /** Reactive: current index into `history`. */
  readonly currentIndex: number;
  /** Jump the editor to the given history index. */
  jumpTo(index: number): void;
  /** Clear all history entries except the current one. */
  clearKeepCurrent(): void;
};
