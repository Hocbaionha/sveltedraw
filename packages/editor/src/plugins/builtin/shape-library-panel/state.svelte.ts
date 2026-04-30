export type ShapeLibraryPanelState = {
  open: boolean;
};

export function createState(): ShapeLibraryPanelState {
  const s: ShapeLibraryPanelState = $state({ open: false });
  return s;
}
