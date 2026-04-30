// Open/closed state for the Help panel. No persistence needed.

export type HelpState = {
  open: boolean;
};

export function createState(): HelpState {
  const s: HelpState = $state({ open: false });
  return s;
}
