// Phase 2h.8: shared mutable globals previously declared at module scope in
// App.tsx. Hoisted into a single object so the engineContextFactory (and
// future engine-side code) can read/write them without circular imports.
//
// All fields are mutable. Any code path that previously did
//   isPanning = true
// now does
//   appGlobals.isPanning = true
// (so the binding is shared via the object, not via the module-level `let`).

import type { Gesture } from "../types";
import type { ScrollBars } from "../scene/types";

export interface AppGlobals {
  didTapTwice: boolean;
  tappedTwiceTimer: number;
  firstTapPosition: { x: number; y: number } | null;
  isHoldingSpace: boolean;
  isPanning: boolean;
  isDraggingScrollBar: boolean;
  currentScrollBars: ScrollBars;
  touchTimeout: number;
  invalidateContextMenu: boolean;
  IS_PLAIN_PASTE: boolean;
  IS_PLAIN_PASTE_TIMER: number;
  PLAIN_PASTE_TOAST_SHOWN: boolean;
  lastPointerUp: (() => void) | null;
  gesture: Gesture;
}

export const appGlobals: AppGlobals = {
  didTapTwice: false,
  tappedTwiceTimer: 0,
  firstTapPosition: null,
  isHoldingSpace: false,
  isPanning: false,
  isDraggingScrollBar: false,
  currentScrollBars: { horizontal: null, vertical: null },
  touchTimeout: 0,
  invalidateContextMenu: false,
  IS_PLAIN_PASTE: false,
  IS_PLAIN_PASTE_TIMER: 0,
  PLAIN_PASTE_TOAST_SHOWN: false,
  lastPointerUp: null,
  gesture: {
    pointers: new Map(),
    lastCenter: null,
    initialDistance: null,
    initialScale: null,
  },
};
