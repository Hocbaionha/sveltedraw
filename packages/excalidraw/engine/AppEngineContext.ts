import type React from "react";

import type { AppState, Gesture } from "../types";
import type { ScrollBars } from "../scene/types";
import type { Scene } from "@excalidraw/element";

/**
 * Minimal context injected into engine modules extracted from App.tsx.
 * Grows as more modules are extracted. Each module only uses the fields it needs.
 */
export interface AppEngineContext {
  // State access
  getState: () => AppState;
  setState: (
    patch:
      | Partial<AppState>
      | ((prevState: AppState) => Partial<AppState> | null),
    callback?: () => void,
  ) => void;

  // Core subsystems
  scene: Scene;

  // Canvas DOM refs
  canvas: HTMLCanvasElement | null;
  interactiveCanvas: HTMLCanvasElement | null;

  // Container DOM ref (for offset calculations)
  excalidrawContainerRef: React.RefObject<HTMLDivElement | null>;

  // Animation
  cancelInProgressAnimation: (() => void) | null;
  setCancelInProgressAnimation: (fn: (() => void) | null) => void;

  // Collab bridge (called by translateCanvas, handleCanvasPanUsingWheelOrSpaceDrag)
  maybeUnfollowRemoteUser: () => void;

  // Module-level singletons required by complex scroll handlers.
  // These are mutable module globals in App.tsx — exposed here via
  // getter/setter pairs so scrollOps functions remain framework-agnostic.
  getIsPanning: () => boolean;
  setIsPanning: (value: boolean) => void;
  getIsHoldingSpace: () => boolean;
  getGesture: () => Gesture;
  getCurrentScrollBars: () => ScrollBars;
  getLastPointerUp: () => (() => void) | null;
  setLastPointerUp: (fn: (() => void) | null) => void;

  // viewport position tracking (used by handleWheel)
  lastViewportPosition: { x: number; y: number };

  // Methods delegated-back from App.tsx (cross-module calls)
  focusContainer: () => void;
  savePointer: (x: number, y: number, button: "up" | "down") => void;
  resetShouldCacheIgnoreZoomDebounced: () => void;
}
