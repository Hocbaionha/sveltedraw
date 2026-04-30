// Bridge published by App.svelte so the autolayout plugin can call
// the editor's autolayout factory (it lives in alignment/handlers
// because layout reuses the alignment math).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AutoLayoutOptions = any;

export const AUTOLAYOUT_BRIDGE_KEY: unique symbol =
  Symbol("autoLayoutPanelBridge");

export type AutoLayoutBridge = {
  /** Reactive: number of currently selected elements. */
  readonly selectedCount: number;
  applyLayout(options: AutoLayoutOptions): void;
};
