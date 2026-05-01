// Plugin-local state for the link-dialog plugin.

export type LinkDialogState = {
  open: boolean;
  /** Element id whose .link field this dialog edits. Cleared on close. */
  targetId: string | null;
};

export function createState(): LinkDialogState {
  const s: LinkDialogState = $state({ open: false, targetId: null });
  return s;
}
