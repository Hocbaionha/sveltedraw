// Bridge between App.svelte and the export-panel plugin.
//
// The plugin owns the panel + options state, but the actual byte-level
// export pipeline lives in App.svelte's handleExport (which is a thin
// wrapper around handleExport.ts that closes over scene + appState +
// binaryFiles). The plugin calls `doExport(opts)` to trigger it.
//
// `getElementCount` is read every time the panel re-renders to display
// "X elements" + the size estimate. It MUST be a getter on a $state
// proxy so the panel re-evaluates on scene changes.

import type { ExportOptions } from "../../../export/types.js";

export const EXPORT_BRIDGE_KEY: unique symbol = Symbol("exportBridge");

export type ExportBridge = {
  /** Reactive: count of non-deleted elements in the current scene. */
  readonly elementCount: number;
  /** Trigger the export pipeline. The host's implementation closes
   *  over scene + appState + binaryFiles and calls onComplete (which
   *  the plugin wires to `state.active = false`). */
  doExport(options: ExportOptions, onComplete: () => void): void;
};
