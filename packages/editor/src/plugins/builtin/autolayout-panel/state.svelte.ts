export type AutoLayoutPanelState = {
  open: boolean;
};

export function createState(): AutoLayoutPanelState {
  const s: AutoLayoutPanelState = $state({ open: false });
  return s;
}
