// Public ImperativeAPI surface exposed via the `onmount` prop.
// Host apps (virtual classroom, embedding wrapper) use this to read/write
// the scene without touching internal stores.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEl = any;

export interface SveltedrawAPI {
  // --- Read ---
  getElements(): readonly AnyEl[];
  getAppState(): Readonly<Record<string, unknown>>;
  getSelectedElements(): readonly AnyEl[];

  // --- Write ---
  updateScene(update: {
    elements?: AnyEl[];
    appState?: Record<string, unknown>;
  }): void;
  addElements(elements: AnyEl[]): void;
  updateElement(id: string, patch: Partial<AnyEl>): void;
  deleteElements(ids: string[]): void;
  resetScene(): void;

  // --- Subscriptions — return cleanup ---
  onChange(
    cb: (elements: readonly AnyEl[], appState: Record<string, unknown>) => void,
  ): () => void;
  onSelectionChange(cb: (selectedElements: readonly AnyEl[]) => void): () => void;
  onToolChange(cb: (tool: string) => void): () => void;

  // --- Export ---
  exportToBlob(opts?: Record<string, unknown>): Promise<Blob>;
  exportToSvg(opts?: Record<string, unknown>): Promise<SVGElement>;

  // --- UI control ---
  setActiveTool(tool: string): void;
  scrollToContent(opts?: { fitToContent?: boolean }): void;
  zoomToFit(): void;

  // --- Context bridge (for plugins to reach feature stores) ---
  getContext<T>(key: symbol): T;
}

export const SVELTEDRAW_API_KEY: unique symbol = Symbol("sveltedrawApi");
