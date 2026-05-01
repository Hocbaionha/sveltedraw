// Plugin-local state for the command palette.

export type CommandPaletteState = {
  open: boolean;
  searchTerm: string;
};

export function createState(): CommandPaletteState {
  const s: CommandPaletteState = $state({ open: false, searchTerm: "" });
  return s;
}
