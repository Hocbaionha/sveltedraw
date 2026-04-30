// Connector tool state — active flag + first-pick tracking. Lives in
// the plugin so the toolbar button + bottom panel + ESC handling all
// observe the same source of truth.

export type ConnectorState = {
  active: boolean;
  firstPickId: string | null;
};

export function createState(): ConnectorState {
  const s: ConnectorState = $state({ active: false, firstPickId: null });
  return s;
}
