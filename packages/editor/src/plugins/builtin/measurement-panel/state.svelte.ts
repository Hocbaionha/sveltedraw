export type MeasurementPanelState = {
  open: boolean;
};

export function createState(): MeasurementPanelState {
  const s: MeasurementPanelState = $state({ open: false });
  return s;
}
