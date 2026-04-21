import type React from "react";

import type { AppState, Gesture, BinaryFiles, BinaryFileData, NullableGridSize, ToolType } from "../types";
import type { EditorInterface } from "@excalidraw/common";
import type { ScrollBars } from "../scene/types";
import type { Scene } from "@excalidraw/element";
import type {
  ExcalidrawElement,
  NonDeleted,
  ExcalidrawEmbeddableElement,
  ExcalidrawFrameLikeElement,
} from "@excalidraw/element/types";
import type { Offsets } from "../types";
import type { Store } from "@excalidraw/element";
import type { ActionManager } from "../actions/manager";
import type { Fonts } from "../fonts";
import type { ClipboardData } from "../clipboard";
import type { LassoTrail } from "../lasso";

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
  store: Store;
  actionManager: ActionManager;
  fonts: Fonts;
  editorInterface: EditorInterface;

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

  // Module-level mutable globals for gesture/touch tracking
  // (didTapTwice, tappedTwiceTimer, firstTapPosition, invalidateContextMenu)
  getDidTapTwice: () => boolean;
  setDidTapTwice: (value: boolean) => void;
  getTappedTwiceTimer: () => number;
  setTappedTwiceTimer: (value: number) => void;
  getFirstTapPosition: () => { x: number; y: number } | null;
  setFirstTapPosition: (value: { x: number; y: number } | null) => void;
  getInvalidateContextMenu: () => boolean;
  setInvalidateContextMenu: (value: boolean) => void;

  // Module-level mutable globals for clipboard tracking
  // (IS_PLAIN_PASTE, PLAIN_PASTE_TOAST_SHOWN)
  getIsPlainPaste: () => boolean;
  getPlainPasteToastShown: () => boolean;
  setPlainPasteToastShown: (value: boolean) => void;

  // Files
  files: BinaryFiles;

  // LassoTrail (used in gesture/touch handlers)
  lassoTrail: LassoTrail;

  // viewport position tracking (used by handleWheel / gesture handlers)
  lastViewportPosition: { x: number; y: number };

  // Props callbacks (injected from component props)
  onPaste?: (
    data: ClipboardData,
    event: ClipboardEvent | null,
  ) => Promise<boolean> | boolean;
  onDuplicate?: (
    nextElements: readonly ExcalidrawElement[],
    prevElements: readonly ExcalidrawElement[],
  ) => ExcalidrawElement[] | void;
  validateEmbeddable?:
    | boolean
    | string[]
    | RegExp
    | RegExp[]
    | ((link: string) => boolean | undefined);

  // Methods delegated-back from App.tsx (cross-module calls)
  focusContainer: () => void;
  savePointer: (x: number, y: number, button: "up" | "down") => void;
  resetShouldCacheIgnoreZoomDebounced: () => void;
  deselectElements: () => void;
  handleCanvasDoubleClick: (
    event: Pick<
      React.MouseEvent<HTMLCanvasElement>,
      "type" | "clientX" | "clientY" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey"
    >,
  ) => void;
  resetContextMenuTimer: () => void;

  // Cross-module method delegates used by clipboardOps
  isToolSupported: <T extends ToolType | "custom">(tool: T) => boolean;
  insertImages: (imageFiles: File[], sceneX: number, sceneY: number) => Promise<void>;
  insertEmbeddableElement: (opts: {
    sceneX: number;
    sceneY: number;
    link: string;
  }) => NonDeleted<ExcalidrawEmbeddableElement> | undefined;
  addMissingFiles: (
    files: BinaryFiles | BinaryFileData[],
    replace?: boolean,
  ) => { addedFiles: BinaryFiles };
  addNewImagesToImageCache: () => Promise<void>;
  getEffectiveGridSize: () => NullableGridSize;
  getTopLayerFrameAtSceneCoords: (sceneCoords: {
    x: number;
    y: number;
  }) => ExcalidrawFrameLikeElement | null;
  getEditorUIOffsets: () => Offsets;
  setActiveTool: (
    tool: ({ type: ToolType } | { type: "custom"; customType: string }) & {
      locked?: boolean;
      fromSelection?: boolean;
    },
    keepSelection?: boolean,
  ) => void;
  setToast: (toast: AppState["toast"]) => void;
  scrollToContent: (
    target?: string | ExcalidrawElement | readonly ExcalidrawElement[],
    opts?: any,
  ) => void;
}
