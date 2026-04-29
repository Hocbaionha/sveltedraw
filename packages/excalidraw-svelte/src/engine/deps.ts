// Shared dependency interface passed into every feature store.
// App.svelte constructs this object from its engine wiring and passes it down.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEl = any;

export type SceneLike = {
  getNonDeletedElements: () => AnyEl[];
  getNonDeletedElementsMap: () => Map<string, AnyEl>;
  getElementsIncludingDeleted: () => AnyEl[];
  getElementById: (id: string) => AnyEl | undefined;
  replaceAllElements: (els: AnyEl[], opts?: { skipValidation?: boolean }) => void;
};

export interface EngineDeps {
  getScene: () => SceneLike | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAppState: () => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patchAppState: (patch: Record<string, any>) => void;
  /** Switch the active tool — delegates to App.svelte's internal setActiveTool
   *  so polyline commits, laser exit, and notifyToolChange all fire correctly. */
  setActiveTool: (tool: string) => void;
  pushHistory: () => void;
  bumpSceneRepaint: () => void;
  toSceneCoords: (clientX: number, clientY: number) => { x: number; y: number };
}
