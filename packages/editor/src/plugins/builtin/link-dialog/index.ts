// Built-in plugin: element-link dialog (A1 hyperlink feature).
//
// Migrates the inline App.svelte wiring (linkDialogOpen, targetId,
// openLinkDialog/confirmLinkDialog/closeLinkDialog, getLinkedElement
// $derived, the "auto-close when target deleted" $effect, and the
// modal markup) to a builtin plugin.
//
// Hooks consumed:
//   - addChromeItem("dialog-layer") → DialogHost (modal overlay)
//   - addAction(edit.editLink, hotkey: CmdOrCtrl+K) → opens via
//     selection check + the published store
//   - onElementChange (Tier-2 hook) → auto-close when target gets
//     deleted under our feet (replaces the inline $effect)
//   - provideStore(LINK_DIALOG_STORE_KEY) → exposes open/close/confirm
//     for the probe surface + chip-on-selection click handler
//
// What the plugin does NOT own:
//   - The "linked-element chip" rendered above selected elements with
//     a link — that lives in App.svelte (it's a selection-derived
//     overlay, not part of the dialog flow). Chip's "edit link"
//     button calls the plugin store's open() method.

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import { createState, type LinkDialogState } from "./state.svelte.js";
import {
  LINK_DIALOG_BRIDGE_KEY,
  type LinkDialogBridge,
} from "./bridge.js";
import DialogHost, { bindDialogHost } from "./DialogHost.svelte";

export const LINK_DIALOG_STORE_KEY: unique symbol = Symbol("linkDialogStore");

export type LinkDialogStore = {
  /** Open the dialog for the currently-selected element. No-op when
   *  selection size != 1 (mirrors the original App.svelte semantics). */
  open: () => void;
  /** Open the dialog for a specific element id. Used by the chip
   *  click handler that knows which element it represents. */
  openForElement: (elementId: string) => void;
  close: () => void;
  isOpen: () => boolean;
  /** Confirm the new link value + close. Wraps bridge.setLink. */
  confirm: (nextLink: string | null) => void;
};

export { LINK_DIALOG_BRIDGE_KEY };
export type { LinkDialogBridge };

export const linkDialogPlugin: SveltedrawPlugin = {
  id: "builtin/link-dialog",
  install(ctx: SveltedrawPluginContext): () => void {
    const state = createState();
    const bridge = ctx.getStore<LinkDialogBridge>(LINK_DIALOG_BRIDGE_KEY);
    if (!bridge) {
      throw new Error(
        `[plugin:builtin/link-dialog] LINK_DIALOG_BRIDGE_KEY not in context — host must publish via registerCtx before plugin install`,
      );
    }

    const store: LinkDialogStore = {
      open: () => {
        // Match the original "must have exactly 1 selection" gate.
        // The single-selection invariant is the dialog's contract —
        // multiple selections would be ambiguous (which element
        // gets the link?) and zero would be a no-op.
        const sel = ctx.api.getSelectedElements();
        if (sel.length !== 1) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state.targetId = (sel[0] as any).id;
        state.open = true;
      },
      openForElement: (elementId) => {
        if (!bridge.isAlive(elementId)) return;
        state.targetId = elementId;
        state.open = true;
      },
      close: () => {
        state.open = false;
        state.targetId = null;
      },
      isOpen: () => state.open,
      confirm: (nextLink) => {
        if (!state.targetId) return;
        bridge.setLink(state.targetId, nextLink);
        state.open = false;
        state.targetId = null;
      },
    };
    const releaseStore = ctx.provideStore(LINK_DIALOG_STORE_KEY, store);

    bindDialogHost({
      state,
      bridge,
      onClose: () => store.close(),
      onConfirm: (nextLink) => store.confirm(nextLink),
    });

    const removeChrome = ctx.addChromeItem({
      id: "dialog",
      slot: "dialog-layer",
      component: DialogHost,
    });

    // Replaces the inline "edit.editLink" core action by overriding
    // its perform path through the plugin store. The action stays
    // in core actions/core.ts (App.svelte registers it via the
    // CoreActionOps.openLinkDialog op), so we don't add a duplicate
    // here — App.svelte's ops.openLinkDialog routes to this store
    // via the same plugin-getStore path that other migrated features
    // use.

    // Auto-close when the target element is removed under our feet.
    // Replaces the inline $effect at App.svelte that watched
    // `getLinkedElement`. onElementChange fires per-id with
    // current=null when an element is deleted; we close if it
    // matches our target.
    const removeElementObs = ctx.onElementChange((change) => {
      if (!state.open) return;
      if (change.id !== state.targetId) return;
      if (change.current === null) {
        // Target deleted (hard or soft). Close to avoid a ghost
        // modal pointing at nothing.
        state.open = false;
        state.targetId = null;
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((change.current as any).isDeleted) {
        state.open = false;
        state.targetId = null;
      }
    });

    return () => {
      removeElementObs();
      removeChrome();
      releaseStore();
    };
  },
};
