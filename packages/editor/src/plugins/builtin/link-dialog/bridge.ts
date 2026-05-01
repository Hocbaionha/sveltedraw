// Bridge for the link-dialog plugin.
//
// The plugin owns the modal UI + open/close state, but element-link
// reads + writes need scene access (mutateElement, getElement). The
// SveltedrawAPI surface doesn't expose either, so the host publishes
// a thin bridge on registerCtx. Same pattern as the persistence
// plugin's PERSISTENCE_SCENE_BRIDGE_KEY.

export const LINK_DIALOG_BRIDGE_KEY: unique symbol = Symbol("linkDialogBridge");

export type LinkDialogBridge = {
  /** Read the element's current `.link` field. Returns null when the
   *  element doesn't exist or has been soft-deleted. */
  getLink: (elementId: string) => string | null;
  /** Mutate the element's `.link` field + push history + repaint.
   *  No-op when the element doesn't exist. */
  setLink: (elementId: string, nextLink: string | null) => void;
  /** Whether the element exists and isn't soft-deleted — used by
   *  the dialog's auto-close effect. */
  isAlive: (elementId: string) => boolean;
};
