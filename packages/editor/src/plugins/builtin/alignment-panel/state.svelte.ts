export type AlignmentPanelState = {
  open: boolean;
};

export function createState(): AlignmentPanelState {
  const s: AlignmentPanelState = $state({ open: false });
  return s;
}
