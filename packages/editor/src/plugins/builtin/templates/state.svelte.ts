// Templates plugin state — modal-only.

export type TemplatesState = {
  open: boolean;
};

export function createState(): TemplatesState {
  const s: TemplatesState = $state({ open: false });
  return s;
}
