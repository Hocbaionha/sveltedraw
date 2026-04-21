import type React from "react";

import type {
  AppClassProperties,
  AppState,
  Gesture,
  BinaryFiles,
  BinaryFileData,
  KeyboardModifiersObject,
  NullableGridSize,
  PointerDownState,
  ToolType,
} from "../types";
import type { EditorInterface } from "@excalidraw/common";
import type { ScrollBars } from "../scene/types";
import type {
  Scene,
  FlowChartCreator,
  FlowChartNavigator,
  LinearElementEditor,
} from "@excalidraw/element";
import type {
  ExcalidrawElement,
  NonDeleted,
  ExcalidrawEmbeddableElement,
  ExcalidrawFrameLikeElement,
  ExcalidrawImageElement,
  ExcalidrawArrowElement,
  ExcalidrawIframeLikeElement,
  NonDeletedExcalidrawElement,
  ExcalidrawTextContainer,
} from "@excalidraw/element/types";
import type { Offsets } from "../types";
import type { Store } from "@excalidraw/element";
import type { ActionManager } from "../actions/manager";
import type { Fonts } from "../fonts";
import type { ClipboardData } from "../clipboard";
import type { LassoTrail } from "../lasso";
import type { LaserTrails } from "../laser-trails";
import type { EraserTrail } from "../eraser";
import type { ActionResult } from "../actions/types";
import type { FrameNameBoundsCache } from "../types";
import type { ExcalidrawTextElement } from "@excalidraw/element/types";

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

  // Collab bridge (called by translateCanvas)
  maybeUnfollowRemoteUser: () => void;

  // Module-level singletons — mutable globals in App.tsx exposed via
  // getter/setter pairs. Used by gestureOps and scrollOps.
  getIsPanning: () => boolean;
  setIsPanning: (value: boolean) => void;
  getIsHoldingSpace: () => boolean;
  getIsDraggingScrollBar: () => boolean;
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
  // (IS_PLAIN_PASTE, PLAIN_PASTE_TOAST_SHOWN, IS_PLAIN_PASTE_TIMER)
  getIsPlainPaste: () => boolean;
  setIsPlainPaste: (value: boolean) => void;
  getIsPlainPasteTimer: () => number;
  setIsPlainPasteTimer: (value: number) => void;
  getPlainPasteToastShown: () => boolean;
  setPlainPasteToastShown: (value: boolean) => void;

  // isHoldingSpace setter (module-level)
  setIsHoldingSpace: (value: boolean) => void;

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

  // keyboardOps — prop access
  propViewModeEnabled: boolean | undefined;

  // keyboardOps delegates
  getLastPointerMoveEvent: () => PointerEvent | null;
  finishImageCropping: () => void;
  startImageCropping: (element: ExcalidrawImageElement) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateEditorAtom: (atom: any, ...args: any[]) => any;
  flowChartCreator: FlowChartCreator;
  flowChartNavigator: FlowChartNavigator;
  triggerRender: (force?: boolean) => void;
  handleSkipBindMode: () => void;
  resetDelayedBindMode: () => void;
  openEyeDropper: (opts: { type: "stroke" | "background" }) => void;
  toggleLock: (source?: "keyboard" | "ui") => void;
  startTextEditing: (opts: any) => void;
  syncActionResult: (result: ActionResult) => void;
  handleDelayedBindModeChange: (
    element: ExcalidrawArrowElement,
    hoveredElement: NonDeletedExcalidrawElement | null,
  ) => void;
  convertElementTypes: (opts: {
    conversionType: any;
    direction?: "left" | "right";
  }) => boolean;
  findShapeByKey: (key: string) => ToolType | null;
  maybeHandleArrowPointlikeDrag: (
    event: KeyboardEvent | React.KeyboardEvent,
  ) => void;

  // pointerDownSubOps delegates
  getLastPointerDownEvent: () => React.PointerEvent<HTMLElement> | null;
  getElementAtPosition: (
    x: number,
    y: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    opts?: any,
  ) => NonDeleted<ExcalidrawElement> | null;
  getTextBindableContainerAtPosition: (
    x: number,
    y: number,
  ) => ExcalidrawTextContainer | null;

  // handleLinearElementOnPointerDown delegate
  getLastPointerMoveCoords: () => { x: number; y: number } | null;

  // handleSelectionOnPointerDown delegates
  setHitLinkElement: (
    element: NonDeletedExcalidrawElement | undefined,
  ) => void;
  clearSelection: (hitElement: ExcalidrawElement | null) => void;
  isASelectedElement: (hitElement: ExcalidrawElement | null) => boolean;
  setOpenDialog: (dialog: AppState["openDialog"]) => void;
  getElementsAtPosition: (
    x: number,
    y: number,
    opts?: {
      includeBoundTextElement?: boolean;
      includeLockedElements?: boolean;
    },
  ) => NonDeleted<ExcalidrawElement>[];
  getElementLinkAtPosition: (
    scenePointer: Readonly<{ x: number; y: number }>,
    hitElementMightBeLocked: NonDeletedExcalidrawElement | null,
  ) => ExcalidrawElement | undefined;
  linearElementEditor_handlePointerDown: (
    event: React.PointerEvent<HTMLElement>,
    scenePointer: { x: number; y: number },
    linearElementEditor: LinearElementEditor,
  ) => {
    didAddPoint: boolean;
    hitElement: NonDeleted<ExcalidrawElement> | null;
    linearElementEditor: LinearElementEditor | null;
  };

  // onPointerMoveFromPointerDownHandler delegates
  handleEraser: (
    event: PointerEvent,
    scenePointer: { x: number; y: number },
  ) => void;
  handlePointerMoveOverScrollbars: (
    event: PointerEvent,
    pointerDownState: PointerDownState,
  ) => boolean;
  imageCache: AppClassProperties["imageCache"];
  laserTrails: LaserTrails;
  maybeCacheReferenceSnapPoints: (
    event: KeyboardModifiersObject,
    selectedElements: ExcalidrawElement[],
    recomputeAnyways?: boolean,
  ) => void;
  maybeCacheVisibleGaps: (
    event: KeyboardModifiersObject,
    selectedElements: ExcalidrawElement[],
    recomputeAnyways?: boolean,
  ) => void;
  maybeDragNewGenericElement: (
    pointerDownState: PointerDownState,
    event: MouseEvent | KeyboardEvent,
    informMutation?: boolean,
  ) => void;
  maybeHandleCrop: (
    pointerDownState: PointerDownState,
    event: MouseEvent | KeyboardEvent,
  ) => boolean;
  maybeHandleResize: (
    pointerDownState: PointerDownState,
    event: MouseEvent | KeyboardEvent,
  ) => boolean;
  getPreviousPointerMoveCoords: () => { x: number; y: number } | null;
  setPreviousPointerMoveCoords: (
    coords: { x: number; y: number } | null,
  ) => void;
  snapDraggedElements: (
    elements: ExcalidrawElement[],
    dragOffset: { x: number; y: number },
    event: KeyboardModifiersObject,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => { snapOffset: any; snapLines: any };
  linearElementEditor_addMidpoint: (
    linearElementEditor: LinearElementEditor,
    pointerCoords: { x: number; y: number },
    snapToGrid: boolean,
  ) => ReturnType<typeof LinearElementEditor.addMidpoint>;
  linearElementEditor_handlePointDragging: (
    event: PointerEvent,
    scenePointerX: number,
    scenePointerY: number,
    linearElementEditor: LinearElementEditor,
  ) => Pick<AppState, "suggestedBinding" | "selectedLinearElement"> | null;
  linearElementEditor_handleBoxSelection: (event: PointerEvent) => void;

  // onPointerUpFromPointerDownHandler delegates
  eraseElements: () => void;
  eraserTrail: EraserTrail;
  getElementHitThreshold: (element: ExcalidrawElement) => number;
  getSelectedTextEditingContainerAtPosition: (
    hitElement: NonDeletedExcalidrawElement | null,
    sceneCoords: { x: number; y: number },
  ) => ExcalidrawTextContainer | null | undefined;
  handleTextWysiwyg: (
    element: ExcalidrawTextElement,
    opts: {
      isExistingElement?: boolean;
      initialCaretSceneCoords?: { x: number; y: number } | null;
    },
  ) => void;
  getLastPointerUpEvent: () =>
    | React.PointerEvent<HTMLElement>
    | PointerEvent
    | null;
  getLastPointerUpIsDoubleClick: () => boolean;
  missingPointerEventCleanupEmitter_clear: () => void;
  onPointerUpEmitter_trigger: (
    activeTool: AppState["activeTool"],
    pointerDownState: PointerDownState,
    event: PointerEvent,
  ) => void;
  removePointer: (
    event: React.PointerEvent<HTMLElement> | PointerEvent,
  ) => void;
  appResetCursor: () => void;
  restoreReadyToEraseElements: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateScene: (sceneData: any) => void;
  getElementsPendingErasure: () => Set<ExcalidrawElement["id"]>;
  frameNameBoundsCache: FrameNameBoundsCache;
  propOnPointerUp?: (
    activeTool: AppState["activeTool"],
    pointerDownState: PointerDownState,
  ) => void;
  updateFrameMembershipOfSelectedElements_facade: <
    T extends
      | readonly ExcalidrawElement[]
      | Map<ExcalidrawElement["id"], ExcalidrawElement>,
  >(
    allElements: T,
  ) => T;
  replaceAllElementsInFrame_facade: <T extends ExcalidrawElement>(
    allElements: readonly T[],
    nextElementsInFrame: ExcalidrawElement[],
    frame: ExcalidrawFrameLikeElement,
  ) => T[];

  // Phase 2f (pointerHelperOps) delegates
  setElementsPendingErasure: (ids: Set<ExcalidrawElement["id"]>) => void;
  isSnappingEnabled_facade: (
    event: KeyboardModifiersObject,
    selectedElements: NonDeletedExcalidrawElement[],
  ) => boolean;
  snapNewElement_facade: (
    newElement: ExcalidrawElement,
    event: KeyboardModifiersObject,
    origin: { x: number; y: number },
    dragOffset: { x: number; y: number },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => { snapOffset: any; snapLines: any };
  snapResizingElements_facade: (
    selectedElements: ExcalidrawElement[],
    selectedOriginalElements: ExcalidrawElement[],
    event: KeyboardModifiersObject,
    dragOffset: { x: number; y: number },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformHandle: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => { snapOffset: any; snapLines: any };

  // Phase 2g (pointerEventOps) delegates — handleCanvasPointerMove
  setLastPointerMoveEvent: (event: PointerEvent | null) => void;
  setLastPointerMoveCoords: (coords: { x: number; y: number } | null) => void;
  getHitLinkElement: () => NonDeletedExcalidrawElement | undefined;
  isHittingTextAutoResizeHandle: (
    selectedElements: NonDeleted<ExcalidrawElement>[],
    point: Readonly<{ x: number; y: number }>,
  ) => boolean;
  isHittingCommonBoundingBoxOfSelectedElements: (
    point: Readonly<{ x: number; y: number }>,
    selectedElements: readonly ExcalidrawElement[],
  ) => boolean;
  handleHoverSelectedLinearElement: (
    linearElementEditor: LinearElementEditor,
    scenePointerX: number,
    scenePointerY: number,
  ) => void;
  handleIframeLikeElementHover: (opts: {
    hitElement: NonDeleted<ExcalidrawElement> | null;
    scenePointer: { x: number; y: number };
    moveEvent: React.PointerEvent<HTMLCanvasElement>;
  }) => boolean;
  linearElementEditor_handlePointerMove: (
    event: PointerEvent,
    scenePointerX: number,
    scenePointerY: number,
    linearElementEditor: LinearElementEditor,
  ) => Pick<AppState, "suggestedBinding" | "selectedLinearElement"> | null;
  linearElementEditor_handlePointerMoveInEditMode: (
    event: React.PointerEvent<HTMLCanvasElement>,
    scenePointerX: number,
    scenePointerY: number,
  ) => LinearElementEditor | null;
  getSnapLinesAtPointer_facade: (
    elements: readonly ExcalidrawElement[],
    pointer: { x: number; y: number },
    event: KeyboardModifiersObject,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => { originOffset: { x: number; y: number }; snapLines: any };

  // Phase 2g (pointerEventOps) delegates — handleCanvasPointerDown
  handleCanvasPointerDown: (
    event: React.PointerEvent<HTMLElement>,
  ) => void;
  setLastPointerDownEvent: (
    event: React.PointerEvent<HTMLElement> | null,
  ) => void;
  setEditorInterface: (patch: Partial<EditorInterface>) => void;
  setAppState: (
    patch:
      | Partial<AppState>
      | ((prevState: AppState) => Partial<AppState> | null),
  ) => void;
  propOnPointerDown?: (
    activeTool: AppState["activeTool"],
    pointerDownState: PointerDownState,
  ) => void;
  onPointerDownEmitter_trigger: (
    activeTool: AppState["activeTool"],
    pointerDownState: PointerDownState,
    event: React.PointerEvent<HTMLElement>,
  ) => void;
  missingPointerEventCleanupEmitter_once: (
    cb: (event: PointerEvent | null) => void,
  ) => () => void;
  maybeCleanupAfterMissingPointerUp: (event: PointerEvent | null) => void;
  maybeOpenContextMenuAfterPointerDownOnTouchDevices: (
    event: React.PointerEvent<HTMLElement>,
  ) => void;
  updateGestureOnPointerDown: (
    event: React.PointerEvent<HTMLElement>,
  ) => void;
  initialPointerDownState: (
    event: React.PointerEvent<HTMLElement>,
  ) => PointerDownState;
  handleTextAutoResizeHandlePointerDown: (
    selectedElements: NonDeleted<ExcalidrawElement>[],
    point: Readonly<{ x: number; y: number }>,
  ) => boolean;
  handleDraggingScrollBar: (
    event: React.PointerEvent<HTMLElement>,
    pointerDownState: PointerDownState,
  ) => boolean;
  clearSelectionIfNotUsingSelection: () => void;
  handleCanvasPanUsingWheelOrSpaceDrag: (
    event: React.PointerEvent<HTMLElement> | MouseEvent,
  ) => boolean;

  // Phase 2h.1 (canvasEventOps) delegates
  getLastCompletedCanvasClicks: () => { x: number; y: number }[];
  setLastCompletedCanvasClicks: (
    clicks: { x: number; y: number }[],
  ) => void;
  setLastPointerUpEvent: (
    event: React.PointerEvent<HTMLElement> | PointerEvent | null,
  ) => void;
  setLastPointerUpIsDoubleClick: (value: boolean) => void;
  isDoubleClick: (
    lastPointerEvent:
      | PointerEvent
      | React.PointerEvent<HTMLElement>
      | undefined
      | null,
    currentPointerEvent: PointerEvent | React.PointerEvent<HTMLElement>,
  ) => boolean;
  handleIframeLikeCenterClick: () => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getContextMenuItems: (type: "element" | "canvas") => any[];
  handleElementLinkClick: (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => void;
  // Phase 2h.4 (bindFrameOps) delegates
  getBindModeHandler: () => ReturnType<typeof setTimeout> | null;
  setBindModeHandler: (
    handler: ReturnType<typeof setTimeout> | null,
  ) => void;
  getPreviousHoveredBindableElement: () => NonDeletedExcalidrawElement | null;
  setPreviousHoveredBindableElement: (
    element: NonDeletedExcalidrawElement | null,
  ) => void;
  getHTMLIFrameElement: (
    element: ExcalidrawIframeLikeElement,
  ) => HTMLIFrameElement | undefined;
  getAppId: () => string;
  propOnLinkOpen?: (
    element: NonDeletedExcalidrawElement,
    event: CustomEvent<{
      nativeEvent: MouseEvent | React.PointerEvent<HTMLCanvasElement>;
    }>,
  ) => void;
}
