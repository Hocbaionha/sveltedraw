export type GridPanelState = {
  open: boolean;
};

export function createState(): GridPanelState {
  const s: GridPanelState = $state({ open: false });
  return s;
}
