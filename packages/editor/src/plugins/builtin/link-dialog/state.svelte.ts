// Plugin-local state for the link-dialog plugin.

export type LinkDialogState = {
  open: boolean;
  /** Element id whose .link field this dialog edits. Cleared on close. */
  targetId: string | null;
  /** Snapshot of the link value at open time. The dialog uses this as
   *  `originalLink` so the "revert" button (and the unsaved-edit
   *  indicator) compares against the value the user *saw* when the
   *  dialog opened — not the live value, which can shift mid-edit
   *  via collab/undo and would make revert behave erratically. */
  originalLink: string | null;
};

export function createState(): LinkDialogState {
  const s: LinkDialogState = $state({ open: false, targetId: null, originalLink: null });
  return s;
}
