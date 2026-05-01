// Built-in plugin: z-order reordering (bring forward / send backward /
// bring to front / send to back).
//
// Migrates the inline `reorderSelected` helper from App.svelte (the
// 17-line wrapper over @sveltedraw/element's moveOne{Left,Right} +
// moveAll{Left,Right}). The four core actions in actions/core.ts
// (`arrange.bringForward` etc) keep their hotkeys + label registration;
// they just call ops which delegate to the published store via
// App.svelte's thin shim. This is the same pattern Wave A.2 used for
// the link-dialog action.
//
// Hooks consumed:
//   - provideStore(Z_ORDER_STORE_KEY) → exposes the four reorder
//     methods so the host's ops + UI buttons + actions all route
//     through one place
//
// Bridge consumed:
//   - Z_ORDER_BRIDGE_KEY (host-published): scene access +
//     pushHistory + bumpSceneRepaint
//
// What the plugin does NOT own:
//   - The keyboard shortcuts. Those live in actions/core.ts and
//     fire via ops. Removing the actions here would break the
//     command-palette + hotkey routing.
//   - The toolbar / context-menu items. App.svelte's UtilityBar and
//     ContextMenu render the buttons; their click handlers go
//     through the plugin store via the host shim.

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import {
  moveOneLeft,
  moveOneRight,
  moveAllLeft,
  moveAllRight,
} from "@sveltedraw/element";
import { Z_ORDER_BRIDGE_KEY, type ZOrderBridge } from "./bridge.js";

export const Z_ORDER_STORE_KEY: unique symbol = Symbol("zOrderStore");

export type ZOrderDirection = "forward" | "backward" | "front" | "back";

export type ZOrderStore = {
  bringForward: () => void;
  sendBackward: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  /** Direct entrypoint for callers that already have a direction
   *  variable (context-menu, command palette). The four named
   *  methods above thin-wrap this. */
  reorder: (direction: ZOrderDirection) => void;
};

export { Z_ORDER_BRIDGE_KEY };
export type { ZOrderBridge };

export const zOrderPlugin: SveltedrawPlugin = {
  id: "builtin/z-order",
  install(ctx: SveltedrawPluginContext): () => void {
    const bridge = ctx.getStore<ZOrderBridge>(Z_ORDER_BRIDGE_KEY);
    if (!bridge) {
      throw new Error(
        `[plugin:builtin/z-order] Z_ORDER_BRIDGE_KEY not in context — host must publish via registerCtx before plugin install`,
      );
    }

    const reorder = (direction: ZOrderDirection) => {
      const scene = bridge.getScene();
      if (!scene) return;
      const selected = ctx.api.getSelectedElements();
      // No-op on empty selection. Matches the original inline
      // semantics — the host's UI buttons are gated by the same
      // "has selection" predicate (see actions/core.ts) but the
      // plugin store is callable from any caller, so the gate
      // also lives here.
      if (selected.length === 0) return;
      // skipValidation: fractional-index sync runs inside the
      // helpers; replaceAllElements would re-validate and
      // possibly reorder again. Original inline code took the
      // same shortcut.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elements = scene.getElementsIncludingDeleted() as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appState = ctx.api.getAppState() as any;
      let next;
      if (direction === "forward") next = moveOneRight(elements, appState, scene);
      else if (direction === "backward") next = moveOneLeft(elements, appState, scene);
      else if (direction === "front") next = moveAllRight(elements, appState);
      else if (direction === "back") next = moveAllLeft(elements, appState);
      else {
        // Defense in depth: TypeScript's ZOrderDirection union catches
        // typed callers, but the published store is reachable from
        // probe code, devtools console, and future plugin-from-plugin
        // calls that may stringify a direction. A no-op for unknown
        // directions is safer than letting an `undefined` next array
        // reach replaceAllElements + crash inside the engine.
        return;
      }
      scene.replaceAllElements(next, { skipValidation: true });
      bridge.pushHistory();
      bridge.bumpSceneRepaint();
    };

    const store: ZOrderStore = {
      reorder,
      bringForward: () => reorder("forward"),
      sendBackward: () => reorder("backward"),
      bringToFront: () => reorder("front"),
      sendToBack: () => reorder("back"),
    };

    return ctx.provideStore(Z_ORDER_STORE_KEY, store);
  },
};
