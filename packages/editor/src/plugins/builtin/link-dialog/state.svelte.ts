// Plugin-local state for the link-dialog plugin.

export type LinkDialogState = {
  open: boolean;
  /** Element id whose .link field this dialog edits. Cleared on close. */
  targetId: string | null;
  /** Snapshot of the link value at open time. The dialog uses this as
   *  `originalLink` so the "revert" button (and the unsaved-edit
   *  indicator) compares against the value the user *saw* when the
   *  dialog opened — not the live value, which can shift mid-edit
   *  via collab/undo and would make revert behave erratically.
   *
   *  KNOWN UX EDGE CASE: if a collab teammate mutates the link
   *  mid-edit (X → Y), the dialog's "Remove" button visibility
   *  reflects the snapshot (X non-null → visible) even when the
   *  current saved value is null. Clicking Remove then would
   *  clobber the teammate's value. We accept this because:
   *    1. The window for the race is small (user-typing duration).
   *    2. Refreshing the snapshot mid-edit makes the diff check
   *       (`nextLink !== originalLink`) drift — the user's "I'm
   *       changing this" reference moves under their feet.
   *    3. The teammate's mutation is itself in their undo history;
   *       a clobber is recoverable.
   *  Revisit if the collab UX gets serious enough that mid-edit
   *  external mutations are common. */
  originalLink: string | null;
};

export function createState(): LinkDialogState {
  const s: LinkDialogState = $state({ open: false, targetId: null, originalLink: null });
  return s;
}
