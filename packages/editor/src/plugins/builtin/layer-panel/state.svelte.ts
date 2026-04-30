export type LayerPanelState = {
  open: boolean;
};

export function createState(): LayerPanelState {
  const s: LayerPanelState = $state({ open: false });
  return s;
}
