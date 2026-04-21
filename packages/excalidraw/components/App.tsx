import clsx from "clsx";
import throttle from "lodash.throttle";
import React, { useContext } from "react";
import { flushSync } from "react-dom";
import rough from "roughjs/bin/rough";
import { nanoid } from "nanoid";

import {
  clamp,
  pointFrom,
  pointDistance,
  vector,
  pointRotateRads,
  vectorFromPoint,
  vectorSubtract,
  vectorDot,
  vectorNormalize,
} from "@excalidraw/math";

import {
  COLOR_PALETTE,
  CODES,
  shouldResizeFromCenter,
  shouldMaintainAspectRatio,
  shouldRotateWithDiscreteAngle,
  isArrowKey,
  KEYS,
  APP_NAME,
  CURSOR_TYPE,
  DEFAULT_TRANSFORM_HANDLE_SPACING,
  DEFAULT_MAX_IMAGE_WIDTH_OR_HEIGHT,
  DEFAULT_VERTICAL_ALIGN,
  DRAGGING_THRESHOLD,
  ELEMENT_SHIFT_TRANSLATE_AMOUNT,
  ELEMENT_TRANSLATE_AMOUNT,
  EVENT,
  FRAME_STYLE,
  IMAGE_MIME_TYPES,
  IMAGE_RENDER_TIMEOUT,
  LINE_CONFIRM_THRESHOLD,
  MAX_ALLOWED_FILE_BYTES,
  MIME_TYPES,
  MQ_RIGHT_SIDEBAR_MIN_WIDTH,
  POINTER_BUTTON,
  ROUNDNESS,
  SCROLL_TIMEOUT,
  TAP_TWICE_TIMEOUT,
  TEXT_TO_CENTER_SNAP_THRESHOLD,
  THEME,
  TOUCH_CTX_MENU_TIMEOUT,
  VERTICAL_ALIGN,
  YOUTUBE_STATES,
  ZOOM_STEP,
  POINTER_EVENTS,
  TOOL_TYPE,
  supportsResizeObserver,
  DEFAULT_COLLISION_THRESHOLD,
  DEFAULT_TEXT_ALIGN,
  ARROW_TYPE,
  DEFAULT_REDUCED_GLOBAL_ALPHA,
  isLocalLink,
  normalizeLink,
  toValidURL,
  getGridPoint,
  getLineHeight,
  debounce,
  distance,
  getFontString,
  getNearestScrollableContainer,
  isInputLike,
  isToolIcon,
  isWritableElement,
  sceneCoordsToViewportCoords,
  tupleToCoors,
  viewportCoordsToSceneCoords,
  wrapEvent,
  updateObject,
  updateActiveTool,
  isTransparent,
  easeToValuesRAF,
  muteFSAbortError,
  isTestEnv,
  isDevEnv,
  easeOut,
  updateStable,
  addEventListener,
  normalizeEOL,
  getDateTime,
  isShallowEqual,
  arrayToMap,
  applyDarkModeFilter,
  AppEventBus,
  type EXPORT_IMAGE_TYPES,
  randomInteger,
  CLASSES,
  Emitter,
  MINIMUM_ARROW_SIZE,
  DOUBLE_TAP_POSITION_THRESHOLD,
  BIND_MODE_TIMEOUT,
  invariant,
  getFeatureFlag,
  createUserAgentDescriptor,
  getFormFactor,
  deriveStylesPanelMode,
  isIOS,
  isBrave,
  isSafari,
  type EditorInterface,
  type StylesPanelMode,
  loadDesktopUIModePreference,
  setDesktopUIMode,
  isSelectionLikeTool,
  oneOf,
} from "@excalidraw/common";

import {
  getObservedAppState,
  getCommonBounds,
  getElementAbsoluteCoords,
  bindOrUnbindBindingElements,
  fixBindingsAfterDeletion,
  getHoveredElementForBinding,
  isBindingEnabled,
  updateBoundElements,
  LinearElementEditor,
  newElementWith,
  newFrameElement,
  newFreeDrawElement,
  newEmbeddableElement,
  newMagicFrameElement,
  newIframeElement,
  newArrowElement,
  newElement,
  newImageElement,
  newLinearElement,
  newTextElement,
  refreshTextDimensions,
  deepCopyElement,
  duplicateElements,
  hasBoundTextElement,
  isArrowElement,
  isBindingElement,
  isBindingElementType,
  isBoundToContainer,
  isFrameLikeElement,
  isImageElement,
  isEmbeddableElement,
  isInitializedImageElement,
  isLinearElement,
  isLinearElementType,
  isUsingAdaptiveRadius,
  isIframeElement,
  isIframeLikeElement,
  isMagicFrameElement,
  isTextBindableContainer,
  isElbowArrow,
  isFlowchartNodeElement,
  isBindableElement,
  isTextElement,
  getNormalizedDimensions,
  isElementCompletelyInViewport,
  isElementInViewport,
  isInvisiblySmallElement,
  getCornerRadius,
  isPathALoop,
  createSrcDoc,
  embeddableURLValidator,
  maybeParseEmbedSrc,
  getEmbedLink,
  getInitializedImageElements,
  normalizeSVG,
  updateImageCache as _updateImageCache,
  getBoundTextElement,
  getContainerCenter,
  getContainerElement,
  isValidTextContainer,
  redrawTextBoundingBox,
  hasBoundingBox,
  getFrameChildren,
  isCursorInFrame,
  addElementsToFrame,
  replaceAllElementsInFrame,
  removeElementsFromFrame,
  getElementsInResizingFrame,
  getElementsInNewFrame,
  getContainingFrame,
  elementOverlapsWithFrame,
  updateFrameMembershipOfSelectedElements,
  isElementInFrame,
  getFrameLikeTitle,
  getElementsOverlappingFrame,
  filterElementsEligibleAsFrameChildren,
  hitElementBoundText,
  hitElementBoundingBoxOnly,
  hitElementItself,
  getVisibleSceneBounds,
  FlowChartCreator,
  FlowChartNavigator,
  getLinkDirectionFromKey,
  cropElement,
  wrapText,
  isElementLink,
  parseElementLinkFromURL,
  isMeasureTextSupported,
  normalizeText,
  measureText,
  getLineHeightInPx,
  getApproxMinLineWidth,
  getApproxMinLineHeight,
  getMinTextElementWidth,
  ShapeCache,
  getRenderOpacity,
  editGroupForSelectedElement,
  getElementsInGroup,
  getSelectedGroupIdForElement,
  getSelectedGroupIds,
  isElementInGroup,
  isSelectedViaGroup,
  selectGroupsForSelectedElements,
  syncInvalidIndices,
  syncMovedIndices,
  excludeElementsInFramesFromSelection,
  getSelectionStateForElements,
  makeNextSelectedElementIds,
  getResizeOffsetXY,
  getResizeArrowDirection,
  transformElements,
  getCursorForResizingElement,
  getElementWithTransformHandleType,
  getTransformHandleTypeFromCoords,
  dragNewElement,
  dragSelectedElements,
  getDragOffsetXY,
  isNonDeletedElement,
  Scene,
  Store,
  CaptureUpdateAction,
  type ElementUpdate,
  hitElementBoundingBox,
  isLineElement,
  isSimpleArrow,
  StoreDelta,
  type ApplyToOptions,
  positionElementsOnGrid,
  calculateFixedPointForNonElbowArrowBinding,
  bindOrUnbindBindingElement,
  mutateElement,
  getElementBounds,
  doBoundsIntersect,
  isPointInElement,
  maxBindingDistance_simple,
  convertToExcalidrawElements,
  type ExcalidrawElementSkeleton,
  getSnapOutlineMidPoint,
  handleFocusPointDrag,
  handleFocusPointHover,
  handleFocusPointPointerDown,
  handleFocusPointPointerUp,
  maybeHandleArrowPointlikeDrag,
  getUncroppedWidthAndHeight,
  getActiveTextElement,
} from "@excalidraw/element";

import type { GlobalPoint, LocalPoint, Radians } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawGenericElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  NonDeleted,
  InitializedExcalidrawImageElement,
  ExcalidrawImageElement,
  FileId,
  NonDeletedExcalidrawElement,
  ExcalidrawTextContainer,
  ExcalidrawFrameLikeElement,
  ExcalidrawMagicFrameElement,
  ExcalidrawIframeLikeElement,
  IframeData,
  ExcalidrawIframeElement,
  ExcalidrawEmbeddableElement,
  Ordered,
  MagicGenerationData,
  ExcalidrawArrowElement,
  ExcalidrawElbowArrowElement,
  SceneElementsMap,
  ExcalidrawBindableElement,
} from "@excalidraw/element/types";

import type { Mutable, ValueOf } from "@excalidraw/common/utility-types";

import {
  actionAddToLibrary,
  actionBringForward,
  actionBringToFront,
  actionCopy,
  actionCopyAsPng,
  actionCopyAsSvg,
  copyText,
  actionCopyStyles,
  actionCut,
  actionDeleteSelected,
  actionDuplicateSelection,
  actionFinalize,
  actionFlipHorizontal,
  actionFlipVertical,
  actionGroup,
  actionPasteStyles,
  actionSelectAll,
  actionSendBackward,
  actionSendToBack,
  actionToggleGridMode,
  actionToggleStats,
  actionToggleZenMode,
  actionUnbindText,
  actionBindText,
  actionUngroup,
  actionLink,
  actionToggleElementLock,
  actionToggleLinearEditor,
  actionToggleObjectsSnapMode,
  actionToggleArrowBinding,
  actionToggleMidpointSnapping,
  actionToggleCropEditor,
} from "../actions";
import { actionWrapTextInContainer } from "../actions/actionBoundText";
import { actionToggleHandTool, zoomToFit } from "../actions/actionCanvas";
import { actionPaste } from "../actions/actionClipboard";
import { actionCopyElementLink } from "../actions/actionElementLink";
import { actionUnlockAllElements } from "../actions/actionElementLock";
import {
  actionRemoveAllElementsFromFrame,
  actionSelectAllElementsInFrame,
  actionWrapSelectionInFrame,
} from "../actions/actionFrame";
import { createRedoAction, createUndoAction } from "../actions/actionHistory";
import { actionTextAutoResize } from "../actions/actionTextAutoResize";
import { actionToggleViewMode } from "../actions/actionToggleViewMode";
import { ActionManager } from "../actions/manager";
import { actions } from "../actions/register";
import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { trackEvent } from "../analytics";
import { AnimationFrameHandler } from "../animation-frame-handler";
import {
  getDefaultAppState,
  isEraserActive,
  isHandToolActive,
} from "../appState";
import {
  copyTextToSystemClipboard,
  parseClipboard,
  parseDataTransferEvent,
  type ParsedDataTransferFile,
} from "../clipboard";

import { exportCanvas, loadFromBlob } from "../data";
import Library, { distributeLibraryItemsOnSquareGrid } from "../data/library";
import { restoreAppState, restoreElements } from "../data/restore";
import { getCenter, getDistance } from "../gesture";
import { History } from "../history";
import { defaultLang, getLanguage, languages, setLanguage, t } from "../i18n";

import {
  calculateScrollCenter,
  getElementsWithinSelection,
  getNormalizedZoom,
  getSelectedElements,
  hasBackground,
  isSomeElementSelected,
} from "../scene";
import { getStateForZoom } from "../scene/zoom";
import {
  dataURLToString,
  generateIdFromFile,
  getDataURL,
  getDataURL_sync,
  ImageURLToFile,
  isImageFileHandle,
  isSupportedImageFile,
  loadSceneOrLibraryFromBlob,
  normalizeFile,
  parseLibraryJSON,
  resizeImageFile,
  SVGStringToFile,
} from "../data/blob";

import { fileOpen } from "../data/filesystem";
import {
  showHyperlinkTooltip,
  hideHyperlinkToolip,
  Hyperlink,
} from "../components/hyperlink/Hyperlink";

import { Fonts } from "../fonts";
import { editorJotaiStore, type WritableAtom } from "../editor-jotai";
import { ImageSceneDataError } from "../errors";
import {
  getSnapLinesAtPointer,
  snapDraggedElements,
  isActiveToolNonLinearSnappable,
  snapNewElement,
  snapResizingElements,
  isSnappingEnabled,
  getVisibleGaps,
  getReferenceSnapPoints,
  SnapCache,
  isGridModeEnabled,
} from "../snapping";
import { Renderer } from "../scene/Renderer";
import {
  setEraserCursor,
  setCursor,
  resetCursor,
  setCursorForShape,
} from "../cursor";
import { ElementCanvasButtons } from "../components/ElementCanvasButtons";
import { LaserTrails } from "../laser-trails";
import { withBatchedUpdates, withBatchedUpdatesThrottled } from "../reactUtils";
import { isPointHittingTextAutoResizeHandle } from "../textAutoResizeHandle";
import { textWysiwyg } from "../wysiwyg/textWysiwyg";
import { isOverScrollBars } from "../scene/scrollbars";

import { isMaybeMermaidDefinition } from "../mermaid";

import { LassoTrail } from "../lasso";

import { EraserTrail } from "../eraser";

import { getShortcutKey } from "../shortcut";

import { tryParseSpreadsheet } from "../charts";

import ConvertElementTypePopup, {
  getConversionTypeFromElements,
  convertElementTypePopupAtom,
  convertElementTypes,
} from "./ConvertElementTypePopup";

import { activeConfirmDialogAtom } from "./ActiveConfirmDialog";
import BraveMeasureTextError from "./BraveMeasureTextError";
import { ContextMenu, CONTEXT_MENU_SEPARATOR } from "./ContextMenu";
import { activeEyeDropperAtom } from "./EyeDropper";
import FollowMode from "./FollowMode/FollowMode";
import LayerUI from "./LayerUI";
import { ElementCanvasButton } from "./MagicButton";
import { SVGLayer } from "./SVGLayer";
import { searchItemInFocusAtom } from "./SearchMenu";
import { isSidebarDockedAtom } from "./Sidebar/Sidebar";
import { StaticCanvas, InteractiveCanvas } from "./canvases";
import NewElementCanvas from "./canvases/NewElementCanvas";
import { isPointHittingLink } from "./hyperlink/helpers";
import { MagicIcon, copyIcon, fullscreenIcon } from "./icons";
import { AppStateObserver, type OnStateChange } from "./AppStateObserver";

import { findShapeByKey } from "./shapes";

import UnlockPopup from "./UnlockPopup";

import type { ExcalidrawLibraryIds } from "../data/types";

import type {
  RenderInteractiveSceneCallback,
  ScrollBars,
} from "../scene/types";

import type { ClipboardData, PastedMixedContent } from "../clipboard";
import type { ExportedElements } from "../data";
import type { ContextMenuItems } from "./ContextMenu";

import type {
  AppClassProperties,
  AppProps,
  AppState,
  BinaryFileData,
  ExcalidrawImperativeAPI,
  BinaryFiles,
  Gesture,
  GestureEvent,
  LibraryItems,
  PointerDownState,
  SceneData,
  FrameNameBoundsCache,
  SidebarName,
  SidebarTabName,
  KeyboardModifiersObject,
  CollaboratorPointer,
  ToolType,
  OnUserFollowedPayload,
  UnsubscribeCallback,
  EmbedsValidationStatus,
  ElementsPendingErasure,
  ExcalidrawImperativeAPIEventMap,
  GenerateDiagramToCode,
  NullableGridSize,
  Offsets,
} from "../types";
import type { RoughCanvas } from "roughjs/bin/canvas";
import type { Action, ActionResult } from "../actions/types";

import { scrollOps, gestureOps, clipboardOps, keyboardOps, pointerDownSubOps, pointerMoveOps, pointerUpOps, pointerHelperOps, pointerEventOps, canvasEventOps, textOps, imageEraseOps, bindFrameOps, linearHoverContextOps, type AppEngineContext } from "../engine";
import { YOUTUBE_VIDEO_STATES } from "../engine/youtubeStates";

const AppContext = React.createContext<AppClassProperties>(null!);
const AppPropsContext = React.createContext<AppProps>(null!);

const editorInterfaceContextInitialValue: EditorInterface = {
  formFactor: "desktop",
  desktopUIMode: "full",
  userAgent: createUserAgentDescriptor(
    typeof navigator !== "undefined" ? navigator.userAgent : "",
  ),
  isTouchScreen: false,
  canFitSidebar: false,
  isLandscape: true,
};
const EditorInterfaceContext = React.createContext<EditorInterface>(
  editorInterfaceContextInitialValue,
);
EditorInterfaceContext.displayName = "EditorInterfaceContext";

const editorLifecycleEventBehavior = {
  "editor:mount": { cardinality: "once", replay: "last" },
  "editor:initialize": { cardinality: "once", replay: "last" },
  "editor:unmount": { cardinality: "once", replay: "last" },
} as const;

export const ExcalidrawContainerContext = React.createContext<{
  container: HTMLDivElement | null;
  id: string | null;
}>({ container: null, id: null });
ExcalidrawContainerContext.displayName = "ExcalidrawContainerContext";

const ExcalidrawElementsContext = React.createContext<
  readonly NonDeletedExcalidrawElement[]
>([]);
ExcalidrawElementsContext.displayName = "ExcalidrawElementsContext";

const ExcalidrawAppStateContext = React.createContext<AppState>({
  ...getDefaultAppState(),
  width: 0,
  height: 0,
  offsetLeft: 0,
  offsetTop: 0,
});
ExcalidrawAppStateContext.displayName = "ExcalidrawAppStateContext";

const ExcalidrawSetAppStateContext = React.createContext<
  React.Component<any, AppState>["setState"]
>(() => {
  console.warn("Uninitialized ExcalidrawSetAppStateContext context!");
});
ExcalidrawSetAppStateContext.displayName = "ExcalidrawSetAppStateContext";

const ExcalidrawActionManagerContext = React.createContext<ActionManager>(
  null!,
);
ExcalidrawActionManagerContext.displayName = "ExcalidrawActionManagerContext";

export const ExcalidrawAPIContext =
  React.createContext<ExcalidrawImperativeAPI | null>(null);
ExcalidrawAPIContext.displayName = "ExcalidrawAPIContext";

export const ExcalidrawAPISetContext = React.createContext<
  ((api: ExcalidrawImperativeAPI | null) => void) | null
>(null);
ExcalidrawAPISetContext.displayName = "ExcalidrawAPISetContext";

export const useApp = () => useContext(AppContext);
export const useAppProps = () => useContext(AppPropsContext);
export const useEditorInterface = () =>
  useContext<EditorInterface>(EditorInterfaceContext);
export const useStylesPanelMode = () =>
  deriveStylesPanelMode(useEditorInterface());
export const useExcalidrawContainer = () =>
  useContext(ExcalidrawContainerContext);
export const useExcalidrawElements = () =>
  useContext(ExcalidrawElementsContext);
export const useExcalidrawAppState = () =>
  useContext(ExcalidrawAppStateContext);
export const useExcalidrawSetAppState = () =>
  useContext(ExcalidrawSetAppStateContext);
export const useExcalidrawActionManager = () =>
  useContext(ExcalidrawActionManagerContext);
/**
 * Requires wrapping your component in <ExcalidrawAPIContext.Provider>
 */
export const useExcalidrawAPI = () => useContext(ExcalidrawAPIContext);

let didTapTwice: boolean = false;
let tappedTwiceTimer = 0;
let firstTapPosition: { x: number; y: number } | null = null;
let isHoldingSpace: boolean = false;
let isPanning: boolean = false;
let isDraggingScrollBar: boolean = false;
let currentScrollBars: ScrollBars = { horizontal: null, vertical: null };
let touchTimeout = 0;
let invalidateContextMenu = false;

// YOUTUBE_VIDEO_STATES is now hoisted into engine/youtubeStates.ts so engine
// modules can access the same Map.

let IS_PLAIN_PASTE = false;
let IS_PLAIN_PASTE_TIMER = 0;
let PLAIN_PASTE_TOAST_SHOWN = false;

let lastPointerUp: (() => void) | null = null;
const gesture: Gesture = {
  pointers: new Map(),
  lastCenter: null,
  initialDistance: null,
  initialScale: null,
};

class App extends React.Component<AppProps, AppState> {
  canvas: AppClassProperties["canvas"];
  interactiveCanvas: AppClassProperties["interactiveCanvas"] = null;
  public sessionExportThemeOverride: AppState["theme"] | undefined;
  rc: RoughCanvas;
  unmounted: boolean = false;
  actionManager: ActionManager;
  editorInterface: EditorInterface = editorInterfaceContextInitialValue;
  private stylesPanelMode: StylesPanelMode = deriveStylesPanelMode(
    editorInterfaceContextInitialValue,
  );

  private excalidrawContainerRef = React.createRef<HTMLDivElement>();

  public scene: Scene;
  public fonts: Fonts;
  public renderer: Renderer;
  public visibleElements: readonly NonDeletedExcalidrawElement[];
  private resizeObserver: ResizeObserver | undefined;
  public library: AppClassProperties["library"];
  public libraryItemsFromStorage: LibraryItems | undefined;
  public id: string;
  private store: Store;
  private history: History;
  public excalidrawContainerValue: {
    container: HTMLDivElement | null;
    id: string;
  };

  public files: BinaryFiles = {};
  public imageCache: AppClassProperties["imageCache"] = new Map();
  private iFrameRefs = new Map<ExcalidrawElement["id"], HTMLIFrameElement>();
  /**
   * Indicates whether the embeddable's url has been validated for rendering.
   * If value not set, indicates that the validation is pending.
   * Initially or on url change the flag is not reset so that we can guarantee
   * the validation came from a trusted source (the editor).
   **/
  private embedsValidationStatus: EmbedsValidationStatus = new Map();
  /** embeds that have been inserted to DOM (as a perf optim, we don't want to
   * insert to DOM before user initially scrolls to them) */
  private initializedEmbeds = new Set<ExcalidrawIframeLikeElement["id"]>();

  private elementsPendingErasure: ElementsPendingErasure = new Set();

  private _initialized = false;

  private readonly editorLifecycleEvents = new AppEventBus<
    ExcalidrawImperativeAPIEventMap,
    typeof editorLifecycleEventBehavior
  >(editorLifecycleEventBehavior);

  public onEvent = this.editorLifecycleEvents.on.bind(
    this.editorLifecycleEvents,
  ) as AppEventBus<
    ExcalidrawImperativeAPIEventMap,
    typeof editorLifecycleEventBehavior
  >["on"];

  private appStateObserver = new AppStateObserver(() => this.state);

  public onStateChange: OnStateChange = this.appStateObserver.onStateChange;

  public flowChartCreator: FlowChartCreator = new FlowChartCreator();
  private flowChartNavigator: FlowChartNavigator = new FlowChartNavigator();

  bindModeHandler: ReturnType<typeof setTimeout> | null = null;

  hitLinkElement?: NonDeletedExcalidrawElement;
  lastPointerDownEvent: React.PointerEvent<HTMLElement> | null = null;
  lastPointerUpEvent: React.PointerEvent<HTMLElement> | PointerEvent | null =
    null;
  // TODO this is a hack and we should ideally unify touch and pointer events
  // and implement our own double click handling end-to-end (currently we're
  // using a mix of native browser for click events and manual for touch -
  // and browser doubleClick sucks to begin with)
  lastPointerUpIsDoubleClick: boolean = false;
  lastPointerMoveEvent: PointerEvent | null = null;
  /** current frame pointer cords */
  lastPointerMoveCoords: { x: number; y: number } | null = null;
  private lastCompletedCanvasClicks: { x: number; y: number }[] = [];
  /** previous frame pointer coords */
  previousPointerMoveCoords: { x: number; y: number } | null = null;
  lastViewportPosition = { x: 0, y: 0 };

  animationFrameHandler = new AnimationFrameHandler();

  laserTrails = new LaserTrails(this.animationFrameHandler, this);
  eraserTrail = new EraserTrail(this.animationFrameHandler, this);
  lassoTrail = new LassoTrail(this.animationFrameHandler, this);

  onChangeEmitter = new Emitter<
    [
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ]
  >();

  onPointerDownEmitter = new Emitter<
    [
      activeTool: AppState["activeTool"],
      pointerDownState: PointerDownState,
      event: React.PointerEvent<HTMLElement>,
    ]
  >();

  onPointerUpEmitter = new Emitter<
    [
      activeTool: AppState["activeTool"],
      pointerDownState: PointerDownState,
      event: PointerEvent,
    ]
  >();
  onUserFollowEmitter = new Emitter<[payload: OnUserFollowedPayload]>();
  onScrollChangeEmitter = new Emitter<
    [scrollX: number, scrollY: number, zoom: AppState["zoom"]]
  >();

  missingPointerEventCleanupEmitter = new Emitter<
    [event: PointerEvent | null]
  >();
  onRemoveEventListenersEmitter = new Emitter<[]>();

  api: ExcalidrawImperativeAPI;

  private createExcalidrawAPI(): ExcalidrawImperativeAPI {
    const api: ExcalidrawImperativeAPI = {
      isDestroyed: false,
      updateScene: this.updateScene,
      applyDeltas: this.applyDeltas,
      mutateElement: this.mutateElement,
      updateLibrary: this.library.updateLibrary,
      addFiles: this.addFiles,
      resetScene: this.resetScene,
      getSceneElementsIncludingDeleted: this.getSceneElementsIncludingDeleted,
      getSceneElementsMapIncludingDeleted:
        this.getSceneElementsMapIncludingDeleted,
      history: {
        clear: this.resetHistory,
      },
      scrollToContent: this.scrollToContent,
      getSceneElements: this.getSceneElements,
      getAppState: () => this.state,
      getFiles: () => this.files,
      getName: this.getName,
      registerAction: (action: Action) => {
        this.actionManager.registerAction(action);
      },
      refresh: this.refresh,
      setToast: this.setToast,
      id: this.id,
      setActiveTool: this.setActiveTool,
      setCursor: this.setCursor,
      resetCursor: this.resetCursor,
      getEditorInterface: () => this.editorInterface,
      updateFrameRendering: this.updateFrameRendering,
      toggleSidebar: this.toggleSidebar,
      onChange: (cb) => this.onChangeEmitter.on(cb),
      onIncrement: (cb) => this.store.onStoreIncrementEmitter.on(cb),
      onPointerDown: (cb) => this.onPointerDownEmitter.on(cb),
      onPointerUp: (cb) => this.onPointerUpEmitter.on(cb),
      onScrollChange: (cb) => this.onScrollChangeEmitter.on(cb),
      onUserFollow: (cb) => this.onUserFollowEmitter.on(cb),
      onStateChange: this.onStateChange,
      onEvent: this.onEvent,
    };
    return api;
  }

  constructor(props: AppProps) {
    super(props);
    const defaultAppState = getDefaultAppState();
    const {
      viewModeEnabled = false,
      zenModeEnabled = false,
      gridModeEnabled = false,
      objectsSnapModeEnabled = false,
      theme = defaultAppState.theme,
      name = `${t("labels.untitled")}-${getDateTime()}`,
    } = props;

    this.state = {
      ...defaultAppState,
      theme,
      exportWithDarkMode: theme === THEME.DARK,
      isLoading: true,
      ...this.getCanvasOffsets(),
      viewModeEnabled,
      zenModeEnabled,
      objectsSnapModeEnabled,
      gridModeEnabled: gridModeEnabled ?? defaultAppState.gridModeEnabled,
      name,
      width: window.innerWidth,
      height: window.innerHeight,
    };

    this.refreshEditorInterface();
    this.stylesPanelMode = deriveStylesPanelMode(this.editorInterface);

    this.id = nanoid();
    this.library = new Library(this);
    this.actionManager = new ActionManager(
      this.syncActionResult,
      () => this.state,
      () => this.scene.getElementsIncludingDeleted(),
      this,
    );
    this.scene = new Scene();

    this.canvas = document.createElement("canvas");
    this.rc = rough.canvas(this.canvas);
    this.renderer = new Renderer(this.scene);
    this.visibleElements = [];

    this.store = new Store(this);
    this.history = new History(this.store);

    this.excalidrawContainerValue = {
      container: this.excalidrawContainerRef.current,
      id: this.id,
    };

    this.fonts = new Fonts(this.scene);
    this.history = new History(this.store);

    this.actionManager.registerAll(actions);
    this.actionManager.registerAction(createUndoAction(this.history));
    this.actionManager.registerAction(createRedoAction(this.history));

    // in case internal editor APIs call this early, otherwise we need
    // to construct this in componentDidMount because componentWillUnmount
    // will invalidate it (so in StrictMode, doing this in constructor alone
    // would be a problem)
    this.api = this.createExcalidrawAPI();
  }

  /**
   * Minimal context object injected into engine modules (scrollOps, etc.)
   * extracted from App.tsx. Only exposes the fields each module actually needs.
   * Grows as more modules are extracted from the class.
   */
  private get engineContext(): AppEngineContext {
    return {
      getState: () => this.state,
      setState: (patch, callback) => this.setState(patch as any, callback),
      scene: this.scene,
      store: this.store,
      actionManager: this.actionManager,
      fonts: this.fonts,
      editorInterface: this.editorInterface,
      canvas: this.canvas,
      interactiveCanvas: this.interactiveCanvas,
      excalidrawContainerRef: this.excalidrawContainerRef,
      cancelInProgressAnimation: this.cancelInProgressAnimation,
      setCancelInProgressAnimation: (fn) => {
        this.cancelInProgressAnimation = fn;
      },
      maybeUnfollowRemoteUser: () => this.maybeUnfollowRemoteUser(),
      // Module-level singletons accessed via getters/setters
      getIsPanning: () => isPanning,
      setIsPanning: (value) => {
        isPanning = value;
      },
      getIsHoldingSpace: () => isHoldingSpace,
      getIsDraggingScrollBar: () => isDraggingScrollBar,
      getGesture: () => gesture,
      getCurrentScrollBars: () => currentScrollBars,
      getLastPointerUp: () => lastPointerUp,
      setLastPointerUp: (fn) => {
        lastPointerUp = fn;
      },
      // Module-level mutable globals for gesture/touch tracking
      getDidTapTwice: () => didTapTwice,
      setDidTapTwice: (value) => {
        didTapTwice = value;
      },
      getTappedTwiceTimer: () => tappedTwiceTimer,
      setTappedTwiceTimer: (value) => {
        tappedTwiceTimer = value;
      },
      getFirstTapPosition: () => firstTapPosition,
      setFirstTapPosition: (value) => {
        firstTapPosition = value;
      },
      getInvalidateContextMenu: () => invalidateContextMenu,
      setInvalidateContextMenu: (value) => {
        invalidateContextMenu = value;
      },
      // Module-level mutable globals for clipboard tracking
      getIsPlainPaste: () => IS_PLAIN_PASTE,
      setIsPlainPaste: (value) => {
        IS_PLAIN_PASTE = value;
      },
      getIsPlainPasteTimer: () => IS_PLAIN_PASTE_TIMER,
      setIsPlainPasteTimer: (value) => {
        IS_PLAIN_PASTE_TIMER = value;
      },
      getPlainPasteToastShown: () => PLAIN_PASTE_TOAST_SHOWN,
      setPlainPasteToastShown: (value) => {
        PLAIN_PASTE_TOAST_SHOWN = value;
      },
      setIsHoldingSpace: (value) => {
        isHoldingSpace = value;
      },
      // Files
      files: this.files,
      // LassoTrail
      lassoTrail: this.lassoTrail,
      // Viewport tracking
      lastViewportPosition: this.lastViewportPosition,
      // Props callbacks
      onPaste: this.props.onPaste,
      onDuplicate: this.props.onDuplicate,
      validateEmbeddable: this.props.validateEmbeddable,
      // Cross-module method delegates
      focusContainer: () => this.focusContainer(),
      savePointer: (x, y, button) => this.savePointer(x, y, button),
      resetShouldCacheIgnoreZoomDebounced: () =>
        this.resetShouldCacheIgnoreZoomDebounced(),
      deselectElements: () => this.deselectElements(),
      handleCanvasDoubleClick: (event) => this.handleCanvasDoubleClick(event),
      resetContextMenuTimer: () => this.resetContextMenuTimer(),
      // clipboardOps delegates
      isToolSupported: (tool) => this.isToolSupported(tool),
      insertImages: (imageFiles, sceneX, sceneY) =>
        this.insertImages(imageFiles, sceneX, sceneY),
      insertEmbeddableElement: (opts) => this.insertEmbeddableElement(opts),
      addMissingFiles: (files, replace) => this.addMissingFiles(files, replace),
      addNewImagesToImageCache: () => this.addNewImagesToImageCache(),
      getEffectiveGridSize: () => this.getEffectiveGridSize(),
      getTopLayerFrameAtSceneCoords: (coords) =>
        this.getTopLayerFrameAtSceneCoords(coords),
      getEditorUIOffsets: () => this.getEditorUIOffsets(),
      setActiveTool: (tool, keepSelection) =>
        this.setActiveTool(tool, keepSelection),
      setToast: (toast) => this.setToast(toast),
      scrollToContent: (target, opts) => this.scrollToContent(target as any, opts),
      // keyboardOps
      propViewModeEnabled: this.props.viewModeEnabled,
      getLastPointerMoveEvent: () => this.lastPointerMoveEvent,
      finishImageCropping: () => this.finishImageCropping(),
      startImageCropping: (element) => this.startImageCropping(element),
      updateEditorAtom: (atom, ...args) =>
        (this.updateEditorAtom as any)(atom, ...args),
      flowChartCreator: this.flowChartCreator,
      flowChartNavigator: this.flowChartNavigator,
      triggerRender: (force) => this.triggerRender(force),
      handleSkipBindMode: () => this.handleSkipBindMode(),
      resetDelayedBindMode: () => this.resetDelayedBindMode(),
      openEyeDropper: (opts) => this.openEyeDropper(opts),
      toggleLock: (source) => this.toggleLock(source),
      startTextEditing: (opts) => this.startTextEditing(opts),
      syncActionResult: (result) => this.syncActionResult(result),
      handleDelayedBindModeChange: (element, hoveredElement) =>
        this.handleDelayedBindModeChange(element, hoveredElement),
      convertElementTypes: (opts) => convertElementTypes(this, opts),
      findShapeByKey: (key) => findShapeByKey(key, this) as ToolType | null,
      maybeHandleArrowPointlikeDrag: (event) =>
        maybeHandleArrowPointlikeDrag({ app: this, event }),
      getLastPointerDownEvent: () => this.lastPointerDownEvent,
      getElementAtPosition: (x, y, opts) => this.getElementAtPosition(x, y, opts),
      getTextBindableContainerAtPosition: (x, y) =>
        this.getTextBindableContainerAtPosition(x, y),
      getLastPointerMoveCoords: () => this.lastPointerMoveCoords,
      setHitLinkElement: (element) => {
        this.hitLinkElement = element;
      },
      clearSelection: (hitElement) => this.clearSelection(hitElement),
      isASelectedElement: (hitElement) => this.isASelectedElement(hitElement),
      setOpenDialog: (dialog) => this.setOpenDialog(dialog),
      getElementsAtPosition: (x, y, opts) =>
        this.getElementsAtPosition(x, y, opts),
      getElementLinkAtPosition: (scenePointer, hitElementMightBeLocked) =>
        this.getElementLinkAtPosition(scenePointer, hitElementMightBeLocked),
      linearElementEditor_handlePointerDown: (event, scenePointer, lee) =>
        LinearElementEditor.handlePointerDown(
          event,
          this,
          this.store,
          scenePointer,
          lee,
          this.scene,
        ),
      handleEraser: (event, scenePointer) =>
        this.handleEraser(event, scenePointer),
      handlePointerMoveOverScrollbars: (event, pointerDownState) =>
        this.handlePointerMoveOverScrollbars(event, pointerDownState),
      imageCache: this.imageCache,
      laserTrails: this.laserTrails,
      maybeCacheReferenceSnapPoints: (event, selectedElements, recompute) =>
        this.maybeCacheReferenceSnapPoints(event, selectedElements, recompute),
      maybeCacheVisibleGaps: (event, selectedElements, recompute) =>
        this.maybeCacheVisibleGaps(event, selectedElements, recompute),
      maybeDragNewGenericElement: (pointerDownState, event, informMutation) =>
        this.maybeDragNewGenericElement(
          pointerDownState,
          event,
          informMutation,
        ),
      maybeHandleCrop: (pointerDownState, event) =>
        this.maybeHandleCrop(pointerDownState, event),
      maybeHandleResize: (pointerDownState, event) =>
        this.maybeHandleResize(pointerDownState, event),
      getPreviousPointerMoveCoords: () => this.previousPointerMoveCoords,
      setPreviousPointerMoveCoords: (coords) => {
        this.previousPointerMoveCoords = coords;
      },
      snapDraggedElements: (elements, dragOffset, event) =>
        snapDraggedElements(
          elements,
          dragOffset,
          this,
          event,
          this.scene.getNonDeletedElementsMap(),
        ),
      linearElementEditor_addMidpoint: (lee, pointerCoords, snapToGrid) =>
        LinearElementEditor.addMidpoint(
          lee,
          pointerCoords,
          this,
          snapToGrid,
          this.scene,
        ),
      linearElementEditor_handlePointDragging: (event, x, y, lee) =>
        LinearElementEditor.handlePointDragging(event, this, x, y, lee),
      linearElementEditor_handleBoxSelection: (event) =>
        LinearElementEditor.handleBoxSelection(
          event,
          this.state,
          this.setState.bind(this),
          this.scene.getNonDeletedElementsMap(),
        ),
      eraseElements: () => this.eraseElements(),
      eraserTrail: this.eraserTrail,
      getElementHitThreshold: (element) => this.getElementHitThreshold(element),
      getSelectedTextEditingContainerAtPosition: (hitElement, sceneCoords) =>
        this.getSelectedTextEditingContainerAtPosition(hitElement, sceneCoords),
      handleTextWysiwyg: (element, opts) =>
        this.handleTextWysiwyg(element, opts),
      getLastPointerUpEvent: () => this.lastPointerUpEvent,
      getLastPointerUpIsDoubleClick: () => this.lastPointerUpIsDoubleClick,
      missingPointerEventCleanupEmitter_clear: () =>
        this.missingPointerEventCleanupEmitter.clear(),
      onPointerUpEmitter_trigger: (activeTool, pointerDownState, event) =>
        this.onPointerUpEmitter.trigger(activeTool, pointerDownState, event),
      removePointer: (event) => this.removePointer(event),
      appResetCursor: () => this.resetCursor(),
      restoreReadyToEraseElements: () => this.restoreReadyToEraseElements(),
      updateScene: this.updateScene,
      getElementsPendingErasure: () => this.elementsPendingErasure,
      frameNameBoundsCache: this.frameNameBoundsCache,
      propOnPointerUp: this.props?.onPointerUp,
      updateFrameMembershipOfSelectedElements_facade: (allElements) =>
        updateFrameMembershipOfSelectedElements(
          allElements,
          this.state,
          this,
        ),
      replaceAllElementsInFrame_facade: (
        allElements,
        nextElementsInFrame,
        frame,
      ) =>
        replaceAllElementsInFrame(
          allElements,
          nextElementsInFrame,
          frame,
          this,
        ),
      setElementsPendingErasure: (ids) => {
        this.elementsPendingErasure = ids;
      },
      isSnappingEnabled_facade: (event, selectedElements) =>
        isSnappingEnabled({ event, app: this, selectedElements }),
      snapNewElement_facade: (newElement, event, origin, dragOffset) =>
        snapNewElement(
          newElement,
          this,
          event,
          origin,
          dragOffset,
          this.scene.getNonDeletedElementsMap(),
        ),
      snapResizingElements_facade: (
        selectedElements,
        selectedOriginalElements,
        event,
        dragOffset,
        transformHandle,
      ) =>
        snapResizingElements(
          selectedElements,
          selectedOriginalElements,
          this,
          event,
          dragOffset,
          transformHandle,
        ),
      setLastPointerMoveEvent: (event) => {
        this.lastPointerMoveEvent = event;
      },
      setLastPointerMoveCoords: (coords) => {
        this.lastPointerMoveCoords = coords;
      },
      getHitLinkElement: () => this.hitLinkElement,
      isHittingTextAutoResizeHandle: (selectedElements, point) =>
        this.isHittingTextAutoResizeHandle(selectedElements, point),
      isHittingCommonBoundingBoxOfSelectedElements: (point, selectedElements) =>
        this.isHittingCommonBoundingBoxOfSelectedElements(
          point,
          selectedElements,
        ),
      handleHoverSelectedLinearElement: (lee, x, y) =>
        this.handleHoverSelectedLinearElement(lee, x, y),
      handleIframeLikeElementHover: (opts) =>
        this.handleIframeLikeElementHover(opts),
      linearElementEditor_handlePointerMove: (event, x, y, lee) =>
        LinearElementEditor.handlePointerMove(event, this, x, y, lee),
      linearElementEditor_handlePointerMoveInEditMode: (event, x, y) =>
        LinearElementEditor.handlePointerMoveInEditMode(event, x, y, this),
      getSnapLinesAtPointer_facade: (elements, pointer, event) =>
        getSnapLinesAtPointer(
          elements,
          this,
          pointer,
          event,
          this.scene.getNonDeletedElementsMap(),
        ),
      handleCanvasPointerDown: (event) => this.handleCanvasPointerDown(event),
      setLastPointerDownEvent: (event) => {
        this.lastPointerDownEvent = event;
      },
      setEditorInterface: (patch) => {
        this.editorInterface = updateObject(this.editorInterface, patch);
      },
      setAppState: (patch) =>
        this.setAppState(patch as Pick<AppState, keyof AppState>),
      propOnPointerDown: this.props?.onPointerDown,
      onPointerDownEmitter_trigger: (activeTool, pointerDownState, event) =>
        this.onPointerDownEmitter.trigger(activeTool, pointerDownState, event),
      missingPointerEventCleanupEmitter_once: (cb) =>
        this.missingPointerEventCleanupEmitter.once(cb),
      maybeCleanupAfterMissingPointerUp: (event) =>
        this.maybeCleanupAfterMissingPointerUp(event),
      maybeOpenContextMenuAfterPointerDownOnTouchDevices: (event) =>
        this.maybeOpenContextMenuAfterPointerDownOnTouchDevices(event),
      updateGestureOnPointerDown: (event) =>
        this.updateGestureOnPointerDown(event),
      initialPointerDownState: (event) => this.initialPointerDownState(event),
      handleTextAutoResizeHandlePointerDown: (selectedElements, point) =>
        this.handleTextAutoResizeHandlePointerDown(selectedElements, point),
      handleDraggingScrollBar: (event, pointerDownState) =>
        this.handleDraggingScrollBar(event, pointerDownState),
      clearSelectionIfNotUsingSelection: () =>
        this.clearSelectionIfNotUsingSelection(),
      handleCanvasPanUsingWheelOrSpaceDrag: (event) =>
        this.handleCanvasPanUsingWheelOrSpaceDrag(event),
      getLastCompletedCanvasClicks: () => this.lastCompletedCanvasClicks,
      setLastCompletedCanvasClicks: (clicks) => {
        this.lastCompletedCanvasClicks = clicks;
      },
      setLastPointerUpEvent: (event) => {
        this.lastPointerUpEvent = event;
      },
      setLastPointerUpIsDoubleClick: (value) => {
        this.lastPointerUpIsDoubleClick = value;
      },
      isDoubleClick: (prev, curr) => this.isDoubleClick(prev, curr),
      handleIframeLikeCenterClick: () => this.handleIframeLikeCenterClick(),
      getContextMenuItems: (type) => this.getContextMenuItems(type),
      handleElementLinkClick: (event) => this.handleElementLinkClick(event),
      getBindModeHandler: () => this.bindModeHandler,
      setBindModeHandler: (handler) => {
        this.bindModeHandler = handler;
      },
      getPreviousHoveredBindableElement: () =>
        this.previousHoveredBindableElement,
      setPreviousHoveredBindableElement: (element) => {
        this.previousHoveredBindableElement = element;
      },
      getHTMLIFrameElement: (element) => this.getHTMLIFrameElement(element),
      getAppId: () => this.id,
      propOnLinkOpen: this.props?.onLinkOpen,
    };
  }

  updateEditorAtom = <Value, Args extends unknown[], Result>(
    atom: WritableAtom<Value, Args, Result>,
    ...args: Args
  ): Result => {
    const result = editorJotaiStore.set(atom, ...args);
    this.triggerRender();
    return result;
  };

  private onWindowMessage(event: MessageEvent) {
    if (
      event.origin !== "https://player.vimeo.com" &&
      event.origin !== "https://www.youtube.com"
    ) {
      return;
    }

    let data = null;
    try {
      data = JSON.parse(event.data);
    } catch (e) {}
    if (!data) {
      return;
    }

    switch (event.origin) {
      case "https://player.vimeo.com":
        //Allowing for multiple instances of Excalidraw running in the window
        if (data.method === "paused") {
          let source: Window | null = null;
          const iframes = document.body.querySelectorAll(
            "iframe.excalidraw__embeddable",
          );
          if (!iframes) {
            break;
          }
          for (const iframe of iframes as NodeListOf<HTMLIFrameElement>) {
            if (iframe.contentWindow === event.source) {
              source = iframe.contentWindow;
            }
          }
          source?.postMessage(
            JSON.stringify({
              method: data.value ? "play" : "pause",
              value: true,
            }),
            "*",
          );
        }
        break;
      case "https://www.youtube.com":
        if (
          data.event === "infoDelivery" &&
          data.info &&
          data.id &&
          typeof data.info.playerState === "number"
        ) {
          const id = data.id;
          const playerState = data.info.playerState as number;
          if (
            (Object.values(YOUTUBE_STATES) as number[]).includes(playerState)
          ) {
            YOUTUBE_VIDEO_STATES.set(
              id,
              playerState as ValueOf<typeof YOUTUBE_STATES>,
            );
          }
        }
        break;
    }
  }

  private handleSkipBindMode() {
    return bindFrameOps.handleSkipBindMode(this.engineContext);
  }

  private resetDelayedBindMode() {
    return bindFrameOps.resetDelayedBindMode(this.engineContext);
  }

  private previousHoveredBindableElement: NonDeletedExcalidrawElement | null =
    null;

  private handleDelayedBindModeChange(
    arrow: ExcalidrawArrowElement,
    hoveredElement: NonDeletedExcalidrawElement | null,
  ) {
    return bindFrameOps.handleDelayedBindModeChange(
      this.engineContext,
      arrow,
      hoveredElement,
    );
  }

  private cacheEmbeddableRef(
    element: ExcalidrawIframeLikeElement,
    ref: HTMLIFrameElement | null,
  ) {
    if (ref) {
      this.iFrameRefs.set(element.id, ref);
    }
  }

  /**
   * Returns gridSize taking into account `gridModeEnabled`.
   * If disabled, returns null.
   */
  public getEffectiveGridSize = () => {
    return (
      isGridModeEnabled(this) ? this.state.gridSize : null
    ) as NullableGridSize;
  };

  private getTextCreationGridPoint = (x: number, y: number) =>
    textOps.getTextCreationGridPoint(this.engineContext, x, y);

  private getHTMLIFrameElement(
    element: ExcalidrawIframeLikeElement,
  ): HTMLIFrameElement | undefined {
    return this.iFrameRefs.get(element.id);
  }

  private handleIframeLikeElementHover = (opts: {
    hitElement: NonDeleted<ExcalidrawElement> | null;
    scenePointer: { x: number; y: number };
    moveEvent: React.PointerEvent<HTMLCanvasElement>;
  }): boolean => bindFrameOps.handleIframeLikeElementHover(this.engineContext, opts);

  /** @returns true if iframe-like element click handled */
  private handleIframeLikeCenterClick(): boolean {
    return bindFrameOps.handleIframeLikeCenterClick(this.engineContext);
  }

  private isDoubleClick = (
    lastPointerEvent:
      | PointerEvent
      | React.PointerEvent<HTMLElement>
      | undefined
      | null,
    currentPointerEvent: PointerEvent | React.PointerEvent<HTMLElement>,
  ) =>
    bindFrameOps.isDoubleClick(
      this.engineContext,
      lastPointerEvent,
      currentPointerEvent,
    );

  private isIframeLikeElementCenter(
    el: ExcalidrawIframeLikeElement | null,
    event: React.PointerEvent<HTMLElement> | PointerEvent,
    sceneX: number,
    sceneY: number,
  ) {
    return bindFrameOps.isIframeLikeElementCenter(
      this.engineContext,
      el,
      event,
      sceneX,
      sceneY,
    );
  }

  private updateEmbedValidationStatus = (
    element: ExcalidrawEmbeddableElement,
    status: boolean,
  ) => {
    this.embedsValidationStatus.set(element.id, status);
    ShapeCache.delete(element);
  };

  private updateEmbeddables = () => {
    const iframeLikes = new Set<ExcalidrawIframeLikeElement["id"]>();

    let updated = false;
    this.scene.getNonDeletedElements().filter((element) => {
      if (isEmbeddableElement(element)) {
        iframeLikes.add(element.id);
        if (!this.embedsValidationStatus.has(element.id)) {
          updated = true;

          const validated = embeddableURLValidator(
            element.link,
            this.props.validateEmbeddable,
          );

          this.updateEmbedValidationStatus(element, validated);
        }
      } else if (isIframeElement(element)) {
        iframeLikes.add(element.id);
      }
      return false;
    });

    if (updated) {
      this.scene.triggerUpdate();
    }

    // GC
    this.iFrameRefs.forEach((ref, id) => {
      if (!iframeLikes.has(id)) {
        this.iFrameRefs.delete(id);
      }
    });
  };

  private renderEmbeddables() {
    const scale = this.state.zoom.value;
    const normalizedWidth = this.state.width;
    const normalizedHeight = this.state.height;

    const embeddableElements = this.scene
      .getNonDeletedElements()
      .filter(
        (el): el is Ordered<NonDeleted<ExcalidrawIframeLikeElement>> =>
          (isEmbeddableElement(el) &&
            this.embedsValidationStatus.get(el.id) === true) ||
          isIframeElement(el),
      );

    return (
      <>
        {embeddableElements.map((el) => {
          const { x, y } = sceneCoordsToViewportCoords(
            { sceneX: el.x, sceneY: el.y },
            this.state,
          );

          const isVisible = isElementInViewport(
            el,
            normalizedWidth,
            normalizedHeight,
            this.state,
            this.scene.getNonDeletedElementsMap(),
          );
          const hasBeenInitialized = this.initializedEmbeds.has(el.id);

          if (isVisible && !hasBeenInitialized) {
            this.initializedEmbeds.add(el.id);
          }
          const shouldRender = isVisible || hasBeenInitialized;

          if (!shouldRender) {
            return null;
          }

          let src: IframeData | null;

          if (isIframeElement(el)) {
            src = null;

            const data: MagicGenerationData = (el.customData?.generationData ??
              this.magicGenerations.get(el.id)) || {
              status: "error",
              message: "No generation data",
              code: "ERR_NO_GENERATION_DATA",
            };

            if (data.status === "done") {
              const html = data.html;
              src = {
                intrinsicSize: { w: el.width, h: el.height },
                type: "document",
                srcdoc: () => {
                  return html;
                },
              } as const;
            } else if (data.status === "pending") {
              src = {
                intrinsicSize: { w: el.width, h: el.height },
                type: "document",
                srcdoc: () => {
                  return createSrcDoc(`
                    <style>
                      html, body {
                        width: 100%;
                        height: 100%;
                        color: ${
                          this.state.theme === THEME.DARK ? "white" : "black"
                        };
                      }
                      body {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-direction: column;
                        gap: 1rem;
                      }

                      .Spinner {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-left: auto;
                        margin-right: auto;
                      }

                      .Spinner svg {
                        animation: rotate 1.6s linear infinite;
                        transform-origin: center center;
                        width: 40px;
                        height: 40px;
                      }

                      .Spinner circle {
                        stroke: currentColor;
                        animation: dash 1.6s linear 0s infinite;
                        stroke-linecap: round;
                      }

                      @keyframes rotate {
                        100% {
                          transform: rotate(360deg);
                        }
                      }

                      @keyframes dash {
                        0% {
                          stroke-dasharray: 1, 300;
                          stroke-dashoffset: 0;
                        }
                        50% {
                          stroke-dasharray: 150, 300;
                          stroke-dashoffset: -200;
                        }
                        100% {
                          stroke-dasharray: 1, 300;
                          stroke-dashoffset: -280;
                        }
                      }
                    </style>
                    <div class="Spinner">
                      <svg
                        viewBox="0 0 100 100"
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r="46"
                          stroke-width="8"
                          fill="none"
                          stroke-miter-limit="10"
                        />
                      </svg>
                    </div>
                    <div>Generating...</div>
                  `);
                },
              } as const;
            } else {
              let message: string;
              if (data.code === "ERR_GENERATION_INTERRUPTED") {
                message = "Generation was interrupted...";
              } else {
                message = data.message || "Generation failed";
              }
              src = {
                intrinsicSize: { w: el.width, h: el.height },
                type: "document",
                srcdoc: () => {
                  return createSrcDoc(`
                    <style>
                    html, body {
                      height: 100%;
                    }
                      body {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        color: ${COLOR_PALETTE.red[3]};
                      }
                      h1, h3 {
                        margin-top: 0;
                        margin-bottom: 0.5rem;
                      }
                    </style>
                    <h1>Error!</h1>
                    <h3>${message}</h3>
                  `);
                },
              } as const;
            }
          } else {
            src = getEmbedLink(toValidURL(el.link || ""));
          }

          const isActive =
            this.state.activeEmbeddable?.element === el &&
            this.state.activeEmbeddable?.state === "active";
          const isHovered =
            this.state.activeEmbeddable?.element === el &&
            this.state.activeEmbeddable?.state === "hover";

          return (
            <div
              key={el.id}
              className={clsx("excalidraw__embeddable-container", {
                "is-hovered": isHovered,
              })}
              style={{
                transform: isVisible
                  ? `translate(${x - this.state.offsetLeft}px, ${
                      y - this.state.offsetTop
                    }px) scale(${scale})`
                  : "none",
                display: isVisible ? "block" : "none",
                opacity: getRenderOpacity(
                  el,
                  getContainingFrame(el, this.scene.getNonDeletedElementsMap()),
                  this.elementsPendingErasure,
                  null,
                  this.state.openDialog?.name === "elementLinkSelector"
                    ? DEFAULT_REDUCED_GLOBAL_ALPHA
                    : 1,
                ),
                ["--embeddable-radius" as string]: `${getCornerRadius(
                  Math.min(el.width, el.height),
                  el,
                )}px`,
              }}
            >
              <div
                //this is a hack that addresses isse with embedded excalidraw.com embeddable
                //https://github.com/excalidraw/excalidraw/pull/6691#issuecomment-1607383938
                /*ref={(ref) => {
                  if (!this.excalidrawContainerRef.current) {
                    return;
                  }
                  const container = this.excalidrawContainerRef.current;
                  const sh = container.scrollHeight;
                  const ch = container.clientHeight;
                  if (sh !== ch) {
                    container.style.height = `${sh}px`;
                    setTimeout(() => {
                      container.style.height = `100%`;
                    });
                  }
                }}*/
                className="excalidraw__embeddable-container__inner"
                style={{
                  width: isVisible ? `${el.width}px` : 0,
                  height: isVisible ? `${el.height}px` : 0,
                  transform: isVisible ? `rotate(${el.angle}rad)` : "none",
                  pointerEvents: isActive
                    ? POINTER_EVENTS.enabled
                    : POINTER_EVENTS.disabled,
                }}
              >
                {isHovered && (
                  <div className="excalidraw__embeddable-hint">
                    {t("buttons.embeddableInteractionButton")}
                  </div>
                )}
                <div
                  className="excalidraw__embeddable__outer"
                  style={{
                    padding: `${el.strokeWidth}px`,
                  }}
                >
                  {(isEmbeddableElement(el)
                    ? this.props.renderEmbeddable?.(el, this.state)
                    : null) ?? (
                    <iframe
                      ref={(ref) => this.cacheEmbeddableRef(el, ref)}
                      className="excalidraw__embeddable"
                      srcDoc={
                        src?.type === "document"
                          ? src.srcdoc(this.state.theme)
                          : undefined
                      }
                      src={
                        src?.type !== "document" ? src?.link ?? "" : undefined
                      }
                      // https://stackoverflow.com/q/18470015
                      scrolling="no"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Excalidraw Embedded Content"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen={true}
                      sandbox={`${
                        src?.sandbox?.allowSameOrigin ? "allow-same-origin" : ""
                      } allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads`}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </>
    );
  }

  private getFrameNameDOMId = (frameElement: ExcalidrawElement) =>
    bindFrameOps.getFrameNameDOMId(this.engineContext, frameElement);

  frameNameBoundsCache: FrameNameBoundsCache = {
    get: (frameElement) => {
      let bounds = this.frameNameBoundsCache._cache.get(frameElement.id);
      if (
        !bounds ||
        bounds.zoom !== this.state.zoom.value ||
        bounds.versionNonce !== frameElement.versionNonce
      ) {
        const frameNameDiv = document.getElementById(
          this.getFrameNameDOMId(frameElement),
        );

        if (frameNameDiv) {
          const box = frameNameDiv.getBoundingClientRect();
          const boxSceneTopLeft = viewportCoordsToSceneCoords(
            { clientX: box.x, clientY: box.y },
            this.state,
          );
          const boxSceneBottomRight = viewportCoordsToSceneCoords(
            { clientX: box.right, clientY: box.bottom },
            this.state,
          );

          bounds = {
            x: boxSceneTopLeft.x,
            y: boxSceneTopLeft.y,
            width: boxSceneBottomRight.x - boxSceneTopLeft.x,
            height: boxSceneBottomRight.y - boxSceneTopLeft.y,
            angle: 0,
            zoom: this.state.zoom.value,
            versionNonce: frameElement.versionNonce,
          };

          this.frameNameBoundsCache._cache.set(frameElement.id, bounds);

          return bounds;
        }
        return null;
      }

      return bounds;
    },
    /**
     * @private
     */
    _cache: new Map(),
  };

  private resetEditingFrame = (frame: ExcalidrawFrameLikeElement | null) =>
    bindFrameOps.resetEditingFrame(this.engineContext, frame);

  private renderFrameNames = () => {
    if (!this.state.frameRendering.enabled || !this.state.frameRendering.name) {
      if (this.state.editingFrame) {
        this.resetEditingFrame(null);
      }
      return null;
    }

    const isDarkTheme = this.state.theme === THEME.DARK;
    const nonDeletedFramesLikes = this.scene.getNonDeletedFramesLikes();

    const focusedSearchMatch =
      nonDeletedFramesLikes.length > 0
        ? this.state.searchMatches?.focusedId &&
          isFrameLikeElement(
            this.scene.getElement(this.state.searchMatches.focusedId),
          )
          ? this.state.searchMatches.matches.find((sm) => sm.focus)
          : null
        : null;

    return nonDeletedFramesLikes.map((f) => {
      if (
        !isElementInViewport(
          f,
          this.canvas.width / window.devicePixelRatio,
          this.canvas.height / window.devicePixelRatio,
          {
            offsetLeft: this.state.offsetLeft,
            offsetTop: this.state.offsetTop,
            scrollX: this.state.scrollX,
            scrollY: this.state.scrollY,
            zoom: this.state.zoom,
          },
          this.scene.getNonDeletedElementsMap(),
        )
      ) {
        if (this.state.editingFrame === f.id) {
          this.resetEditingFrame(f);
        }
        // if frame not visible, don't render its name
        return null;
      }

      const { x: x1, y: y1 } = sceneCoordsToViewportCoords(
        { sceneX: f.x, sceneY: f.y },
        this.state,
      );

      const FRAME_NAME_EDIT_PADDING = 6;

      let frameNameJSX;

      const frameName = getFrameLikeTitle(f);

      if (f.id === this.state.editingFrame) {
        const frameNameInEdit = frameName;

        frameNameJSX = (
          <input
            autoFocus
            value={frameNameInEdit}
            onChange={(e) => {
              this.scene.mutateElement(f, {
                name: e.target.value,
              });
            }}
            onFocus={(e) => e.target.select()}
            onBlur={() => this.resetEditingFrame(f)}
            onKeyDown={(event) => {
              // for some inexplicable reason, `onBlur` triggered on ESC
              // does not reset `state.editingFrame` despite being called,
              // and we need to reset it here as well
              if (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) {
                this.resetEditingFrame(f);
              }
            }}
            style={{
              background: isDarkTheme
                ? applyDarkModeFilter(this.state.viewBackgroundColor)
                : this.state.viewBackgroundColor,
              zIndex: 2,
              border: "none",
              display: "block",
              padding: `${FRAME_NAME_EDIT_PADDING}px`,
              borderRadius: 4,
              boxShadow: "inset 0 0 0 1px var(--color-primary)",
              fontFamily: "Assistant",
              fontSize: `${FRAME_STYLE.nameFontSize}px`,
              transform: `translate(-${FRAME_NAME_EDIT_PADDING}px, ${FRAME_NAME_EDIT_PADDING}px)`,
              color: isDarkTheme
                ? FRAME_STYLE.nameColorDarkTheme
                : FRAME_STYLE.nameColorLightTheme,
              overflow: "hidden",
              maxWidth: `${
                document.body.clientWidth - x1 - FRAME_NAME_EDIT_PADDING
              }px`,
            }}
            size={frameNameInEdit.length + 1 || 1}
            dir="auto"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
          />
        );
      } else {
        frameNameJSX = frameName;
      }

      return (
        <div
          id={this.getFrameNameDOMId(f)}
          className={CLASSES.FRAME_NAME}
          key={f.id}
          style={{
            position: "absolute",
            // Positioning from bottom so that we don't to either
            // calculate text height or adjust using transform (which)
            // messes up input position when editing the frame name.
            // This makes the positioning deterministic and we can calculate
            // the same position when rendering to canvas / svg.
            bottom: `${
              this.state.height +
              FRAME_STYLE.nameOffsetY -
              y1 +
              this.state.offsetTop
            }px`,
            left: `${x1 - this.state.offsetLeft}px`,
            zIndex: 2,
            fontSize: FRAME_STYLE.nameFontSize,
            color: isDarkTheme
              ? FRAME_STYLE.nameColorDarkTheme
              : FRAME_STYLE.nameColorLightTheme,
            lineHeight: FRAME_STYLE.nameLineHeight,
            width: "max-content",
            maxWidth:
              focusedSearchMatch?.id === f.id && focusedSearchMatch?.focus
                ? "none"
                : `${f.width * this.state.zoom.value}px`,
            overflow: f.id === this.state.editingFrame ? "visible" : "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            cursor: CURSOR_TYPE.MOVE,
            pointerEvents: this.state.viewModeEnabled
              ? POINTER_EVENTS.disabled
              : POINTER_EVENTS.enabled,
          }}
          onPointerDown={(event) => this.handleCanvasPointerDown(event)}
          onWheel={(event) => this.handleWheel(event)}
          onContextMenu={this.handleCanvasContextMenu}
          onDoubleClick={() => {
            this.setState({
              editingFrame: f.id,
            });
          }}
        >
          {frameNameJSX}
        </div>
      );
    });
  };

  private toggleOverscrollBehavior(event: React.PointerEvent) {
    // when pointer inside editor, disable overscroll behavior to prevent
    // panning to trigger history back/forward on MacOS Chrome
    document.documentElement.style.overscrollBehaviorX =
      event.type === "pointerenter" ? "none" : "auto";
  }

  public render() {
    const selectedElements = this.scene.getSelectedElements(this.state);
    const { renderTopRightUI, renderTopLeftUI, renderCustomStats } = this.props;

    const sceneNonce = this.scene.getSceneNonce();
    const { elementsMap, visibleElements } =
      this.renderer.getRenderableElements({
        sceneNonce,
        zoom: this.state.zoom,
        offsetLeft: this.state.offsetLeft,
        offsetTop: this.state.offsetTop,
        scrollX: this.state.scrollX,
        scrollY: this.state.scrollY,
        height: this.state.height,
        width: this.state.width,
        editingTextElement: this.state.editingTextElement,
        newElementId: this.state.newElement?.id,
      });
    this.visibleElements = visibleElements;

    const allElementsMap = this.scene.getNonDeletedElementsMap();

    const shouldBlockPointerEvents =
      // default back to `--ui-pointerEvents` flow if setPointerCapture
      // not supported
      "setPointerCapture" in HTMLElement.prototype
        ? false
        : this.state.selectionElement ||
          this.state.newElement ||
          this.state.selectedElementsAreBeingDragged ||
          this.state.resizingElement ||
          (this.state.activeTool.type === "laser" &&
            // technically we can just test on this once we make it more safe
            this.state.cursorButton === "down");

    const firstSelectedElement = selectedElements[0];

    const showShapeSwitchPanel =
      editorJotaiStore.get(convertElementTypePopupAtom)?.type === "panel";

    return (
      <div
        translate="no"
        className={clsx("excalidraw excalidraw-container notranslate", {
          "excalidraw--view-mode":
            this.state.viewModeEnabled ||
            this.state.openDialog?.name === "elementLinkSelector",
          "excalidraw--mobile": this.editorInterface.formFactor === "phone",
        })}
        style={{
          ["--ui-pointerEvents" as any]: shouldBlockPointerEvents
            ? POINTER_EVENTS.disabled
            : POINTER_EVENTS.enabled,
          ["--right-sidebar-width" as any]: "302px",
        }}
        ref={this.excalidrawContainerRef}
        onDrop={this.handleAppOnDrop}
        tabIndex={0}
        onKeyDown={
          this.props.handleKeyboardGlobally ? undefined : this.onKeyDown
        }
        onPointerEnter={this.toggleOverscrollBehavior}
        onPointerLeave={this.toggleOverscrollBehavior}
      >
        <ExcalidrawAPIContext.Provider value={this.api}>
          <AppContext.Provider value={this}>
            <AppPropsContext.Provider value={this.props}>
              <ExcalidrawContainerContext.Provider
                value={this.excalidrawContainerValue}
              >
                <EditorInterfaceContext.Provider value={this.editorInterface}>
                  <ExcalidrawSetAppStateContext.Provider
                    value={this.setAppState}
                  >
                    <ExcalidrawAppStateContext.Provider value={this.state}>
                      <ExcalidrawElementsContext.Provider
                        value={this.scene.getNonDeletedElements()}
                      >
                        <ExcalidrawActionManagerContext.Provider
                          value={this.actionManager}
                        >
                          <LayerUI
                            canvas={this.canvas}
                            appState={this.state}
                            files={this.files}
                            setAppState={this.setAppState}
                            actionManager={this.actionManager}
                            elements={this.scene.getNonDeletedElements()}
                            onLockToggle={this.toggleLock}
                            onPenModeToggle={this.togglePenMode}
                            onHandToolToggle={this.onHandToolToggle}
                            langCode={getLanguage().code}
                            renderTopLeftUI={renderTopLeftUI}
                            renderTopRightUI={renderTopRightUI}
                            renderCustomStats={renderCustomStats}
                            showExitZenModeBtn={
                              typeof this.props?.zenModeEnabled ===
                                "undefined" && this.state.zenModeEnabled
                            }
                            UIOptions={this.props.UIOptions}
                            onExportImage={this.onExportImage}
                            renderWelcomeScreen={
                              !this.state.isLoading &&
                              this.state.showWelcomeScreen &&
                              this.state.activeTool.type ===
                                this.state.preferredSelectionTool.type &&
                              !this.state.zenModeEnabled &&
                              !this.scene.getElementsIncludingDeleted().length
                            }
                            app={this}
                            isCollaborating={this.props.isCollaborating}
                            generateLinkForSelection={
                              this.props.generateLinkForSelection
                            }
                          >
                            {this.props.children}
                          </LayerUI>

                          <div className="excalidraw-textEditorContainer" />
                          <div className="excalidraw-contextMenuContainer" />
                          <div className="excalidraw-eye-dropper-container" />
                          <SVGLayer
                            trails={[
                              this.laserTrails,
                              this.lassoTrail,
                              this.eraserTrail,
                            ]}
                          />
                          {selectedElements.length === 1 &&
                            this.state.openDialog?.name !==
                              "elementLinkSelector" &&
                            this.state.showHyperlinkPopup && (
                              <Hyperlink
                                key={firstSelectedElement.id}
                                element={firstSelectedElement}
                                scene={this.scene}
                                setAppState={this.setAppState}
                                onLinkOpen={this.props.onLinkOpen}
                                setToast={this.setToast}
                                updateEmbedValidationStatus={
                                  this.updateEmbedValidationStatus
                                }
                              />
                            )}
                          {this.props.aiEnabled !== false &&
                            selectedElements.length === 1 &&
                            isMagicFrameElement(firstSelectedElement) && (
                              <ElementCanvasButtons
                                element={firstSelectedElement}
                                elementsMap={elementsMap}
                              >
                                <ElementCanvasButton
                                  title={t("labels.convertToCode")}
                                  icon={MagicIcon}
                                  checked={false}
                                  onChange={() =>
                                    this.onMagicFrameGenerate(
                                      firstSelectedElement,
                                      "button",
                                    )
                                  }
                                />
                              </ElementCanvasButtons>
                            )}
                          {selectedElements.length === 1 &&
                            isIframeElement(firstSelectedElement) &&
                            firstSelectedElement.customData?.generationData
                              ?.status === "done" && (
                              <ElementCanvasButtons
                                element={firstSelectedElement}
                                elementsMap={elementsMap}
                              >
                                <ElementCanvasButton
                                  title={t("labels.copySource")}
                                  icon={copyIcon}
                                  checked={false}
                                  onChange={() =>
                                    this.onIframeSrcCopy(firstSelectedElement)
                                  }
                                />
                                <ElementCanvasButton
                                  title="Enter fullscreen"
                                  icon={fullscreenIcon}
                                  checked={false}
                                  onChange={() => {
                                    const iframe =
                                      this.getHTMLIFrameElement(
                                        firstSelectedElement,
                                      );
                                    if (iframe) {
                                      try {
                                        iframe.requestFullscreen();
                                        this.setState({
                                          activeEmbeddable: {
                                            element: firstSelectedElement,
                                            state: "active",
                                          },
                                          selectedElementIds: {
                                            [firstSelectedElement.id]: true,
                                          },
                                          newElement: null,
                                          selectionElement: null,
                                        });
                                      } catch (err: any) {
                                        console.warn(err);
                                        this.setState({
                                          errorMessage:
                                            "Couldn't enter fullscreen",
                                        });
                                      }
                                    }
                                  }}
                                />
                              </ElementCanvasButtons>
                            )}

                          {this.state.contextMenu && (
                            <ContextMenu
                              items={this.state.contextMenu.items}
                              top={this.state.contextMenu.top}
                              left={this.state.contextMenu.left}
                              actionManager={this.actionManager}
                              onClose={(callback) => {
                                this.setState({ contextMenu: null }, () => {
                                  this.focusContainer();
                                  callback?.();
                                });
                              }}
                            />
                          )}
                          <StaticCanvas
                            canvas={this.canvas}
                            rc={this.rc}
                            elementsMap={elementsMap}
                            allElementsMap={allElementsMap}
                            visibleElements={visibleElements}
                            sceneNonce={sceneNonce}
                            selectionNonce={
                              this.state.selectionElement?.versionNonce
                            }
                            scale={window.devicePixelRatio}
                            appState={this.state}
                            renderConfig={{
                              imageCache: this.imageCache,
                              isExporting: false,
                              renderGrid: isGridModeEnabled(this),
                              canvasBackgroundColor:
                                this.state.viewBackgroundColor,
                              embedsValidationStatus:
                                this.embedsValidationStatus,
                              elementsPendingErasure:
                                this.elementsPendingErasure,
                              pendingFlowchartNodes:
                                this.flowChartCreator.pendingNodes,
                              theme: this.state.theme,
                            }}
                          />
                          {this.state.newElement && (
                            <NewElementCanvas
                              appState={this.state}
                              scale={window.devicePixelRatio}
                              rc={this.rc}
                              elementsMap={elementsMap}
                              allElementsMap={allElementsMap}
                              renderConfig={{
                                imageCache: this.imageCache,
                                isExporting: false,
                                renderGrid: false,
                                canvasBackgroundColor:
                                  this.state.viewBackgroundColor,
                                embedsValidationStatus:
                                  this.embedsValidationStatus,
                                elementsPendingErasure:
                                  this.elementsPendingErasure,
                                pendingFlowchartNodes: null,
                                theme: this.state.theme,
                              }}
                            />
                          )}
                          <InteractiveCanvas
                            app={this}
                            containerRef={this.excalidrawContainerRef}
                            canvas={this.interactiveCanvas}
                            elementsMap={elementsMap}
                            visibleElements={visibleElements}
                            allElementsMap={allElementsMap}
                            selectedElements={selectedElements}
                            sceneNonce={sceneNonce}
                            selectionNonce={
                              this.state.selectionElement?.versionNonce
                            }
                            scale={window.devicePixelRatio}
                            appState={this.state}
                            renderScrollbars={
                              this.props.renderScrollbars === true
                            }
                            editorInterface={this.editorInterface}
                            renderInteractiveSceneCallback={
                              this.renderInteractiveSceneCallback
                            }
                            handleCanvasRef={this.handleInteractiveCanvasRef}
                            onContextMenu={this.handleCanvasContextMenu}
                            onClick={this.handleCanvasClick}
                            onPointerMove={this.handleCanvasPointerMove}
                            onPointerUp={this.handleCanvasPointerUp}
                            onPointerCancel={this.removePointer}
                            onTouchMove={this.handleTouchMove}
                            onPointerDown={this.handleCanvasPointerDown}
                            onDoubleClick={this.handleCanvasDoubleClick}
                          />
                          {this.state.userToFollow && (
                            <FollowMode
                              width={this.state.width}
                              height={this.state.height}
                              userToFollow={this.state.userToFollow}
                              onDisconnect={this.maybeUnfollowRemoteUser}
                            />
                          )}
                          {this.renderFrameNames()}
                          {this.state.activeLockedId && (
                            <UnlockPopup
                              app={this}
                              activeLockedId={this.state.activeLockedId}
                            />
                          )}
                          {showShapeSwitchPanel && (
                            <ConvertElementTypePopup app={this} />
                          )}
                        </ExcalidrawActionManagerContext.Provider>
                        {this.renderEmbeddables()}
                      </ExcalidrawElementsContext.Provider>
                    </ExcalidrawAppStateContext.Provider>
                  </ExcalidrawSetAppStateContext.Provider>
                </EditorInterfaceContext.Provider>
              </ExcalidrawContainerContext.Provider>
            </AppPropsContext.Provider>
          </AppContext.Provider>
        </ExcalidrawAPIContext.Provider>
      </div>
    );
  }

  public focusContainer: AppClassProperties["focusContainer"] = () => {
    this.excalidrawContainerRef.current?.focus();
  };

  public getSceneElementsIncludingDeleted = () => {
    return this.scene.getElementsIncludingDeleted();
  };

  public getSceneElementsMapIncludingDeleted = () => {
    return this.scene.getElementsMapIncludingDeleted();
  };

  public getSceneElements = () => {
    return this.scene.getNonDeletedElements();
  };

  public onInsertElements = (elements: readonly ExcalidrawElement[]) => {
    this.addElementsFromPasteOrLibrary({
      elements,
      position: "center",
      files: null,
    });
  };

  public onExportImage = async (
    type: keyof typeof EXPORT_IMAGE_TYPES,
    elements: ExportedElements,
    opts: { exportingFrame: ExcalidrawFrameLikeElement | null },
  ) => {
    trackEvent("export", type, "ui");
    const fileHandle = await exportCanvas(
      type,
      elements,
      this.state,
      this.files,
      {
        exportBackground: this.state.exportBackground,
        name: this.getName(),
        viewBackgroundColor: this.state.viewBackgroundColor,
        exportingFrame: opts.exportingFrame,
      },
    )
      .catch(muteFSAbortError)
      .catch((error) => {
        console.error(error);
        this.setState({ errorMessage: error.message });
      });

    if (
      this.state.exportEmbedScene &&
      fileHandle &&
      isImageFileHandle(fileHandle)
    ) {
      this.setState({ fileHandle });
    }
  };

  private magicGenerations = new Map<
    ExcalidrawIframeElement["id"],
    MagicGenerationData
  >();

  private updateMagicGeneration = ({
    frameElement,
    data,
  }: {
    frameElement: ExcalidrawIframeElement;
    data: MagicGenerationData;
  }) => {
    if (data.status === "pending") {
      // We don't wanna persist pending state to storage. It should be in-app
      // state only.
      // Thus reset so that we prefer local cache (if there was some
      // generationData set previously)
      this.scene.mutateElement(
        frameElement,
        {
          customData: { generationData: undefined },
        },
        { informMutation: false, isDragging: false },
      );
    } else {
      this.scene.mutateElement(
        frameElement,
        {
          customData: { generationData: data },
        },
        { informMutation: false, isDragging: false },
      );
    }
    this.magicGenerations.set(frameElement.id, data);
    this.triggerRender();
  };

  public plugins: {
    diagramToCode?: {
      generate: GenerateDiagramToCode;
    };
  } = {};

  public setPlugins(plugins: Partial<App["plugins"]>) {
    Object.assign(this.plugins, plugins);
  }

  private async onMagicFrameGenerate(
    magicFrame: ExcalidrawMagicFrameElement,
    source: "button" | "upstream",
  ) {
    const generateDiagramToCode = this.plugins.diagramToCode?.generate;

    if (!generateDiagramToCode) {
      this.setState({
        errorMessage: "No diagram to code plugin found",
      });
      return;
    }

    const magicFrameChildren = getElementsOverlappingFrame(
      this.scene.getNonDeletedElements(),
      magicFrame,
      this.scene.getNonDeletedElementsMap(),
    ).filter((el) => !isMagicFrameElement(el));

    if (!magicFrameChildren.length) {
      if (source === "button") {
        this.setState({ errorMessage: "Cannot generate from an empty frame" });
        trackEvent("ai", "generate (no-children)", "d2c");
      } else {
        this.setActiveTool({ type: "magicframe" });
      }
      return;
    }

    const frameElement = this.insertIframeElement({
      sceneX: magicFrame.x + magicFrame.width + 30,
      sceneY: magicFrame.y,
      width: magicFrame.width,
      height: magicFrame.height,
    });

    if (!frameElement) {
      return;
    }

    this.updateMagicGeneration({
      frameElement,
      data: { status: "pending" },
    });

    this.setState({
      selectedElementIds: { [frameElement.id]: true },
    });

    trackEvent("ai", "generate (start)", "d2c");
    try {
      const { html } = await generateDiagramToCode({
        frame: magicFrame,
        children: magicFrameChildren,
      });

      trackEvent("ai", "generate (success)", "d2c");

      if (!html.trim()) {
        this.updateMagicGeneration({
          frameElement,
          data: {
            status: "error",
            code: "ERR_OAI",
            message: "Nothing genereated :(",
          },
        });
        return;
      }

      const parsedHtml =
        html.includes("<!DOCTYPE html>") && html.includes("</html>")
          ? html.slice(
              html.indexOf("<!DOCTYPE html>"),
              html.indexOf("</html>") + "</html>".length,
            )
          : html;

      this.updateMagicGeneration({
        frameElement,
        data: { status: "done", html: parsedHtml },
      });
    } catch (error: any) {
      trackEvent("ai", "generate (failed)", "d2c");
      this.updateMagicGeneration({
        frameElement,
        data: {
          status: "error",
          code: "ERR_OAI",
          message: error.message || "Unknown error during generation",
        },
      });
    }
  }

  private onIframeSrcCopy(element: ExcalidrawIframeElement) {
    if (element.customData?.generationData?.status === "done") {
      copyTextToSystemClipboard(element.customData.generationData.html);
      this.setToast({
        message: "copied to clipboard",
        closable: false,
        duration: 1500,
      });
    }
  }

  public onMagicframeToolSelect = () => {
    const selectedElements = this.scene.getSelectedElements({
      selectedElementIds: this.state.selectedElementIds,
    });

    if (selectedElements.length === 0) {
      this.setActiveTool({ type: TOOL_TYPE.magicframe });
      trackEvent("ai", "tool-select (empty-selection)", "d2c");
    } else {
      const selectedMagicFrame: ExcalidrawMagicFrameElement | false =
        selectedElements.length === 1 &&
        isMagicFrameElement(selectedElements[0]) &&
        selectedElements[0];

      // case: user selected elements containing frame-like(s) or are frame
      // members, we don't want to wrap into another magicframe
      // (unless the only selected element is a magic frame which we reuse)
      if (
        !selectedMagicFrame &&
        selectedElements.some((el) => isFrameLikeElement(el) || el.frameId)
      ) {
        this.setActiveTool({ type: TOOL_TYPE.magicframe });
        return;
      }

      trackEvent("ai", "tool-select (existing selection)", "d2c");

      let frame: ExcalidrawMagicFrameElement;
      if (selectedMagicFrame) {
        // a single magicframe already selected -> use it
        frame = selectedMagicFrame;
      } else {
        // selected elements aren't wrapped in magic frame yet -> wrap now

        const [minX, minY, maxX, maxY] = getCommonBounds(selectedElements);
        const padding = 50;

        frame = newMagicFrameElement({
          ...FRAME_STYLE,
          x: minX - padding,
          y: minY - padding,
          width: maxX - minX + padding * 2,
          height: maxY - minY + padding * 2,
          opacity: 100,
          locked: false,
        });

        this.scene.insertElement(frame);

        for (const child of selectedElements) {
          this.scene.mutateElement(child, { frameId: frame.id });
        }

        this.setState({
          selectedElementIds: { [frame.id]: true },
        });
      }

      this.onMagicFrameGenerate(frame, "upstream");
    }
  };

  private openEyeDropper = (opts: { type: "stroke" | "background" }) =>
    imageEraseOps.openEyeDropper(this.engineContext, opts);

  public dismissLinearEditor = () => {
    setTimeout(() => {
      if (this.state.selectedLinearElement?.isEditing) {
        this.setState({
          selectedLinearElement: {
            ...this.state.selectedLinearElement,
            isEditing: false,
          },
        });
      }
    });
  };

  public syncActionResult = withBatchedUpdates((actionResult: ActionResult) => {
    if (this.unmounted || actionResult === false) {
      return;
    }

    this.store.scheduleAction(actionResult.captureUpdate);

    let didUpdate = false;

    let editingTextElement: AppState["editingTextElement"] | null = null;
    if (actionResult.elements) {
      this.scene.replaceAllElements(actionResult.elements);
      didUpdate = true;
    }

    if (actionResult.files) {
      this.addMissingFiles(actionResult.files, actionResult.replaceFiles);
      this.addNewImagesToImageCache();
    }

    if (actionResult.appState || editingTextElement || this.state.contextMenu) {
      let viewModeEnabled = actionResult?.appState?.viewModeEnabled || false;
      let zenModeEnabled = actionResult?.appState?.zenModeEnabled || false;
      const theme =
        actionResult?.appState?.theme || this.props.theme || THEME.LIGHT;
      const name = actionResult?.appState?.name ?? this.state.name;
      const errorMessage =
        actionResult?.appState?.errorMessage ?? this.state.errorMessage;
      if (typeof this.props.viewModeEnabled !== "undefined") {
        viewModeEnabled = this.props.viewModeEnabled;
      }

      if (typeof this.props.zenModeEnabled !== "undefined") {
        zenModeEnabled = this.props.zenModeEnabled;
      }

      editingTextElement = actionResult.appState?.editingTextElement || null;

      // make sure editingTextElement points to latest element reference
      if (actionResult.elements && editingTextElement) {
        actionResult.elements.forEach((element) => {
          if (
            editingTextElement?.id === element.id &&
            editingTextElement !== element &&
            isNonDeletedElement(element) &&
            isTextElement(element)
          ) {
            editingTextElement = element;
          }
        });
      }

      if (editingTextElement?.isDeleted) {
        editingTextElement = null;
      }

      this.setState((prevAppState) => {
        const actionAppState = actionResult.appState || {};

        return {
          ...prevAppState,
          ...actionAppState,
          // NOTE this will prevent opening context menu using an action
          // or programmatically from the host, so it will need to be
          // rewritten later
          contextMenu: null,
          editingTextElement,
          viewModeEnabled,
          zenModeEnabled,
          theme,
          name,
          errorMessage,
        };
      });

      didUpdate = true;
    }

    if (!didUpdate) {
      this.scene.triggerUpdate();
    }
  });

  // Lifecycle

  private onBlur = withBatchedUpdates(() => {
    isHoldingSpace = false;
    this.setState({
      isBindingEnabled: this.state.bindingPreference === "enabled",
    });
  });

  private onUnload = () => {
    this.onBlur();
  };

  private disableEvent: EventListener = (event) => {
    event.preventDefault();
  };

  private resetHistory = () => {
    this.history.clear();
  };

  private resetStore = () => {
    this.store.clear();
  };

  /**
   * Resets scene & history.
   * ! Do not use to clear scene user action !
   */
  private resetScene = withBatchedUpdates(
    (opts?: { resetLoadingState: boolean }) => {
      this.scene.replaceAllElements([]);
      this.setState((state) => ({
        ...getDefaultAppState(),
        isLoading: opts?.resetLoadingState ? false : state.isLoading,
        theme: this.state.theme,
      }));
      this.resetStore();
      this.resetHistory();
    },
  );

  private initializeScene = async () => {
    if ("launchQueue" in window && "LaunchParams" in window) {
      (window as any).launchQueue.setConsumer(
        async (launchParams: { files: any[] }) => {
          if (!launchParams.files.length) {
            return;
          }
          const fileHandle = launchParams.files[0];
          const blob: Blob = await fileHandle.getFile();
          this.loadFileToCanvas(
            new File([blob], blob.name || "", { type: blob.type }),
            fileHandle,
          );
        },
      );
    }

    if (this.props.theme) {
      this.setState({ theme: this.props.theme });
    }
    if (!this.state.isLoading) {
      this.setState({ isLoading: true });
    }
    let initialData = null;
    try {
      if (typeof this.props.initialData === "function") {
        initialData = (await this.props.initialData()) || null;
      } else {
        initialData = (await this.props.initialData) || null;
      }
      if (initialData?.libraryItems) {
        this.library
          .updateLibrary({
            libraryItems: initialData.libraryItems,
            merge: true,
          })
          .catch((error) => {
            console.error(error);
          });
      }
    } catch (error: any) {
      console.error(error);
      initialData = {
        appState: {
          errorMessage:
            error.message ||
            "Encountered an error during importing or restoring scene data",
        },
      };
    }
    const restoredElements = restoreElements(initialData?.elements, null, {
      repairBindings: true,
      deleteInvisibleElements: true,
    });
    let restoredAppState = restoreAppState(initialData?.appState, null);
    const activeTool = restoredAppState.activeTool;

    if (!restoredAppState.preferredSelectionTool.initialized) {
      restoredAppState.preferredSelectionTool = {
        type:
          this.editorInterface.formFactor === "phone" ? "lasso" : "selection",
        initialized: true,
      };
    }

    restoredAppState = {
      ...restoredAppState,
      theme: this.props.theme || restoredAppState.theme,
      // we're falling back to current (pre-init) state when deciding
      // whether to open the library, to handle a case where we
      // update the state outside of initialData (e.g. when loading the app
      // with a library install link, which should auto-open the library)
      openSidebar: restoredAppState?.openSidebar || this.state.openSidebar,
      activeTool:
        activeTool.type === "image" ||
        activeTool.type === "lasso" ||
        activeTool.type === "selection"
          ? {
              ...activeTool,
              type: restoredAppState.preferredSelectionTool.type,
            }
          : restoredAppState.activeTool,
      isLoading: false,
      toast: this.state.toast,
    };

    if (initialData?.scrollToContent) {
      restoredAppState = {
        ...restoredAppState,
        ...calculateScrollCenter(restoredElements, {
          ...restoredAppState,
          width: this.state.width,
          height: this.state.height,
          offsetTop: this.state.offsetTop,
          offsetLeft: this.state.offsetLeft,
        }),
      };
    }

    this.resetStore();
    this.resetHistory();
    this.syncActionResult({
      elements: restoredElements,
      appState: restoredAppState,
      files: initialData?.files,
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    // clear the shape and image cache so that any images in initialData
    // can be loaded fresh
    this.clearImageShapeCache();

    // manually loading the font faces seems faster even in browsers that do fire the loadingdone event
    this.fonts.loadSceneFonts().then((fontFaces) => {
      this.fonts.onLoaded(fontFaces);
    });

    if (isElementLink(window.location.href)) {
      this.scrollToContent(window.location.href, { animate: false });
    }
  };

  private getFormFactor = (editorWidth: number, editorHeight: number) => {
    return (
      this.props.UIOptions.getFormFactor?.(editorWidth, editorHeight) ??
      getFormFactor(editorWidth, editorHeight)
    );
  };

  public refreshEditorInterface = () => {
    const container = this.excalidrawContainerRef.current;
    if (!container) {
      return;
    }

    const { width: editorWidth, height: editorHeight } =
      container.getBoundingClientRect();

    const storedDesktopUIMode = loadDesktopUIModePreference();
    const userAgentDescriptor = createUserAgentDescriptor(
      typeof navigator !== "undefined" ? navigator.userAgent : "",
    );
    // allow host app to control formFactor and desktopUIMode via props
    const sidebarBreakpoint =
      this.props.UIOptions.dockedSidebarBreakpoint != null
        ? this.props.UIOptions.dockedSidebarBreakpoint
        : MQ_RIGHT_SIDEBAR_MIN_WIDTH;
    const nextEditorInterface = updateObject(this.editorInterface, {
      desktopUIMode: storedDesktopUIMode ?? this.editorInterface.desktopUIMode,
      formFactor: this.getFormFactor(editorWidth, editorHeight),
      userAgent: userAgentDescriptor,
      canFitSidebar: editorWidth > sidebarBreakpoint,
      isLandscape: editorWidth > editorHeight,
    });

    this.editorInterface = nextEditorInterface;
    this.reconcileStylesPanelMode(nextEditorInterface);
  };

  private reconcileStylesPanelMode = (nextEditorInterface: EditorInterface) => {
    const nextStylesPanelMode = deriveStylesPanelMode(nextEditorInterface);
    if (nextStylesPanelMode === this.stylesPanelMode) {
      return;
    }

    const prevStylesPanelMode = this.stylesPanelMode;
    this.stylesPanelMode = nextStylesPanelMode;

    if (prevStylesPanelMode !== "full" && nextStylesPanelMode === "full") {
      this.setState((prevState) => ({
        preferredSelectionTool: {
          type: "selection",
          initialized: true,
        },
      }));
    }
  };

  /** TO BE USED LATER */
  private setDesktopUIMode = (mode: EditorInterface["desktopUIMode"]) => {
    const nextMode = setDesktopUIMode(mode);
    this.editorInterface = updateObject(this.editorInterface, {
      desktopUIMode: nextMode,
    });
    this.reconcileStylesPanelMode(this.editorInterface);
  };

  private clearImageShapeCache(filesMap?: BinaryFiles) {
    imageEraseOps.clearImageShapeCache(this.engineContext, filesMap);
  }

  public async componentDidMount() {
    this.unmounted = false;
    this.api = this.createExcalidrawAPI();

    this.excalidrawContainerValue.container =
      this.excalidrawContainerRef.current;

    if (isTestEnv() || isDevEnv()) {
      const setState = this.setState.bind(this);
      Object.defineProperties(window.h, {
        state: {
          configurable: true,
          get: () => {
            return this.state;
          },
        },
        setState: {
          configurable: true,
          value: (...args: Parameters<typeof setState>) => {
            return this.setState(...args);
          },
        },
        app: {
          configurable: true,
          value: this,
        },
        history: {
          configurable: true,
          value: this.history,
        },
        store: {
          configurable: true,
          value: this.store,
        },
        fonts: {
          configurable: true,
          value: this.fonts,
        },
      });
    }

    this.store.onDurableIncrementEmitter.on((increment) => {
      this.history.record(increment.delta);
    });

    // per. optimmisation, only subscribe if there is the `onIncrement` prop registered, to avoid unnecessary computation
    if (this.props.onIncrement) {
      this.store.onStoreIncrementEmitter.on((increment) => {
        this.props.onIncrement?.(increment);
      });
    }

    this.scene.onUpdate(this.triggerRender);
    this.addEventListeners();

    if (this.props.autoFocus && this.excalidrawContainerRef.current) {
      this.focusContainer();
    }

    if (supportsResizeObserver && this.excalidrawContainerRef.current) {
      this.resizeObserver = new ResizeObserver(() => {
        this.refreshEditorInterface();
        this.updateDOMRect();
      });
      this.resizeObserver?.observe(this.excalidrawContainerRef.current);
    }

    const searchParams = new URLSearchParams(window.location.search.slice(1));

    if (searchParams.has("web-share-target")) {
      // Obtain a file that was shared via the Web Share Target API.
      this.restoreFileFromShare();
    } else {
      this.updateDOMRect(this.initializeScene);
    }

    // note that this check seems to always pass in localhost
    if (isBrave() && !isMeasureTextSupported()) {
      this.setState({
        errorMessage: <BraveMeasureTextError />,
      });
    }

    const mountPayload = {
      excalidrawAPI: this.api,
      container: this.excalidrawContainerRef.current,
    };

    this.editorLifecycleEvents.emit("editor:mount", mountPayload);
    this.props.onMount?.(mountPayload);
    this.props.onExcalidrawAPI?.(this.api);
  }

  public componentWillUnmount() {
    // we're recreating the api object reference so that the
    // <ExcalidrawAPIContext.Provider/> picks up on it
    this.api = { ...this.api, isDestroyed: true };

    for (const key of Object.keys(this.api) as (keyof typeof this.api)[]) {
      if (
        (key.startsWith("get") ||
          key === "onStateChange" ||
          key === "onEvent") &&
        typeof this.api[key] === "function"
      ) {
        (this.api as any)[key] = () => {
          throw new Error(
            "ExcalidrawAPI is no longer usable after the editor has been unmounted and will return invalid/empty data. You should check for `ExcalidrawAPI.isDestroyed` before calling get* methods on subscribing to state/event changes.",
          );
        };
      }
    }

    this.editorLifecycleEvents.emit("editor:unmount");
    this.props.onUnmount?.();
    this.props.onExcalidrawAPI?.(null);

    (window as any).launchQueue?.setConsumer(() => {});

    this.renderer.destroy();
    this.scene.destroy();
    this.scene = new Scene();
    this.fonts = new Fonts(this.scene);
    this.renderer = new Renderer(this.scene);
    this.files = {};
    this.imageCache.clear();
    this.resizeObserver?.disconnect();
    this.unmounted = true;
    this.removeEventListeners();
    this.library.destroy();
    this.laserTrails.stop();
    this.eraserTrail.stop();
    this.onChangeEmitter.clear();
    this.store.onStoreIncrementEmitter.clear();
    this.store.onDurableIncrementEmitter.clear();
    this.appStateObserver.clear();
    this.editorLifecycleEvents.clear();
    ShapeCache.destroy();
    SnapCache.destroy();
    clearTimeout(touchTimeout);
    isSomeElementSelected.clearCache();
    selectGroupsForSelectedElements.clearCache();
    touchTimeout = 0;
    document.documentElement.style.overscrollBehaviorX = "";
  }

  private onResize = withBatchedUpdates(() => {
    this.scene
      .getElementsIncludingDeleted()
      .forEach((element) => ShapeCache.delete(element));
    this.refreshEditorInterface();
    this.updateDOMRect();
    this.setState({});
  });

  /** generally invoked only if fullscreen was invoked programmatically */
  private onFullscreenChange = () => {
    if (
      // points to the iframe element we fullscreened
      !document.fullscreenElement &&
      this.state.activeEmbeddable?.state === "active"
    ) {
      this.setState({
        activeEmbeddable: null,
      });
    }
  };

  private removeEventListeners() {
    this.onRemoveEventListenersEmitter.trigger();
  }

  private addEventListeners() {
    // remove first as we can add event listeners multiple times
    this.removeEventListeners();

    // -------------------------------------------------------------------------
    //                        view+edit mode listeners
    // -------------------------------------------------------------------------

    if (this.props.handleKeyboardGlobally) {
      this.onRemoveEventListenersEmitter.once(
        addEventListener(document, EVENT.KEYDOWN, this.onKeyDown, false),
      );
    }

    this.onRemoveEventListenersEmitter.once(
      addEventListener(
        this.excalidrawContainerRef.current,
        EVENT.WHEEL,
        this.handleWheel,
        { passive: false },
      ),
      addEventListener(window, EVENT.MESSAGE, this.onWindowMessage, false),
      addEventListener(document, EVENT.POINTER_UP, this.removePointer, {
        passive: false,
      }), // #3553
      addEventListener(document, EVENT.COPY, this.onCopy, { passive: false }),
      addEventListener(document, EVENT.KEYUP, this.onKeyUp, { passive: true }),
      addEventListener(
        document,
        EVENT.POINTER_MOVE,
        this.updateCurrentCursorPosition,
        { passive: false },
      ),
      // rerender text elements on font load to fix #637 && #1553
      addEventListener(
        document.fonts,
        "loadingdone",
        (event) => {
          const fontFaces = (event as FontFaceSetLoadEvent).fontfaces;
          this.fonts.onLoaded(fontFaces);
        },
        { passive: false },
      ),
      // Safari-only desktop pinch zoom
      addEventListener(
        document,
        EVENT.GESTURE_START,
        this.onGestureStart as any,
        false,
      ),
      addEventListener(
        document,
        EVENT.GESTURE_CHANGE,
        this.onGestureChange as any,
        false,
      ),
      addEventListener(
        document,
        EVENT.GESTURE_END,
        this.onGestureEnd as any,
        false,
      ),
      addEventListener(
        window,
        EVENT.FOCUS,
        () => {
          this.maybeCleanupAfterMissingPointerUp(null);
          // browsers (chrome?) tend to free up memory a lot, which results
          // in canvas context being cleared. Thus re-render on focus.
          this.triggerRender(true);
        },
        { passive: false },
      ),
    );

    if (this.state.viewModeEnabled) {
      return;
    }

    // -------------------------------------------------------------------------
    //                        edit-mode listeners only
    // -------------------------------------------------------------------------

    this.onRemoveEventListenersEmitter.once(
      addEventListener(
        document,
        EVENT.FULLSCREENCHANGE,
        this.onFullscreenChange,
        { passive: false },
      ),
      addEventListener(document, EVENT.PASTE, this.pasteFromClipboard, {
        passive: false,
      }),
      addEventListener(document, EVENT.CUT, this.onCut, { passive: false }),
      addEventListener(window, EVENT.RESIZE, this.onResize, false),
      addEventListener(window, EVENT.UNLOAD, this.onUnload, false),
      addEventListener(window, EVENT.BLUR, this.onBlur, false),
      addEventListener(
        this.excalidrawContainerRef.current,
        EVENT.WHEEL,
        this.handleWheel,
        { passive: false },
      ),
      addEventListener(
        this.excalidrawContainerRef.current,
        EVENT.DRAG_OVER,
        this.disableEvent,
        false,
      ),
      addEventListener(
        this.excalidrawContainerRef.current,
        EVENT.DROP,
        this.disableEvent,
        false,
      ),
    );

    if (this.props.detectScroll) {
      this.onRemoveEventListenersEmitter.once(
        addEventListener(
          getNearestScrollableContainer(this.excalidrawContainerRef.current!),
          EVENT.SCROLL,
          this.onScroll,
          { passive: false },
        ),
      );
    }
  }

  componentDidUpdate(prevProps: AppProps, prevState: AppState) {
    // must be updated *before* state change listeners are triggered below
    if (!this._initialized && !this.state.isLoading) {
      this._initialized = true;
      this.editorLifecycleEvents.emit("editor:initialize", this.api);
      this.props.onInitialize?.(this.api);
    }

    this.appStateObserver.flush(prevState);

    this.updateEmbeddables();
    const elements = this.scene.getElementsIncludingDeleted();
    const elementsMap = this.scene.getElementsMapIncludingDeleted();

    const shouldExportWithDarkMode =
      (this.sessionExportThemeOverride ?? this.state.theme) === THEME.DARK;

    if (this.state.exportWithDarkMode !== shouldExportWithDarkMode) {
      this.setState({ exportWithDarkMode: shouldExportWithDarkMode });
    }

    if (!this.state.showWelcomeScreen && !elements.length) {
      this.setState({ showWelcomeScreen: true });
    }

    const hasFollowedPersonLeft =
      prevState.userToFollow &&
      !this.state.collaborators.has(prevState.userToFollow.socketId);

    if (hasFollowedPersonLeft) {
      this.maybeUnfollowRemoteUser();
    }

    if (
      prevState.zoom.value !== this.state.zoom.value ||
      prevState.scrollX !== this.state.scrollX ||
      prevState.scrollY !== this.state.scrollY
    ) {
      this.props?.onScrollChange?.(
        this.state.scrollX,
        this.state.scrollY,
        this.state.zoom,
      );
      this.onScrollChangeEmitter.trigger(
        this.state.scrollX,
        this.state.scrollY,
        this.state.zoom,
      );
    }

    if (prevState.userToFollow !== this.state.userToFollow) {
      if (prevState.userToFollow) {
        this.onUserFollowEmitter.trigger({
          userToFollow: prevState.userToFollow,
          action: "UNFOLLOW",
        });
      }

      if (this.state.userToFollow) {
        this.onUserFollowEmitter.trigger({
          userToFollow: this.state.userToFollow,
          action: "FOLLOW",
        });
      }
    }

    if (
      Object.keys(this.state.selectedElementIds).length &&
      isEraserActive(this.state)
    ) {
      this.setState({
        activeTool: updateActiveTool(this.state, { type: "selection" }),
      });
    }
    if (
      this.state.activeTool.type === "eraser" &&
      prevState.theme !== this.state.theme
    ) {
      setEraserCursor(this.interactiveCanvas, this.state.theme);
    }

    // Hide hyperlink popup if shown when element type is not selection
    if (
      prevState.activeTool.type === "selection" &&
      this.state.activeTool.type !== "selection" &&
      this.state.showHyperlinkPopup
    ) {
      this.setState({ showHyperlinkPopup: false });
    }
    if (prevProps.langCode !== this.props.langCode) {
      this.updateLanguage();
    }

    if (isEraserActive(prevState) && !isEraserActive(this.state)) {
      this.eraserTrail.endPath();
    }

    if (prevProps.viewModeEnabled !== this.props.viewModeEnabled) {
      this.setState({ viewModeEnabled: !!this.props.viewModeEnabled });
    }

    if (prevState.viewModeEnabled !== this.state.viewModeEnabled) {
      this.addEventListeners();
      this.deselectElements();
    }

    // cleanup
    if (
      (prevState.openDialog?.name === "elementLinkSelector" ||
        this.state.openDialog?.name === "elementLinkSelector") &&
      prevState.openDialog?.name !== this.state.openDialog?.name
    ) {
      this.deselectElements();
      this.setState({
        hoveredElementIds: {},
      });
    }

    if (prevProps.zenModeEnabled !== this.props.zenModeEnabled) {
      this.setState({ zenModeEnabled: !!this.props.zenModeEnabled });
    }

    if (prevProps.theme !== this.props.theme && this.props.theme) {
      this.setState({ theme: this.props.theme });
    }

    this.excalidrawContainerRef.current?.classList.toggle(
      "theme--dark",
      this.state.theme === THEME.DARK,
    );

    if (
      this.state.selectedLinearElement?.isEditing &&
      !this.state.selectedElementIds[this.state.selectedLinearElement.elementId]
    ) {
      // defer so that the scheduleCapture flag isn't reset via current update
      setTimeout(() => {
        // execute only if the condition still holds when the deferred callback
        // executes (it can be scheduled multiple times depending on how
        // many times the component renders)
        this.state.selectedLinearElement?.isEditing &&
          this.actionManager.executeAction(actionFinalize);
      });
    }

    // failsafe in case the state is being updated in incorrect order resulting
    // in the editingTextElement being now a deleted element
    if (this.state.editingTextElement?.isDeleted) {
      this.setState({ editingTextElement: null });
    }

    this.store.commit(elementsMap, this.state);

    // Do not notify consumers if we're still loading the scene. Among other
    // potential issues, this fixes a case where the tab isn't focused during
    // init, which would trigger onChange with empty elements, which would then
    // override whatever is in localStorage currently.
    if (!this.state.isLoading) {
      this.props.onChange?.(elements, this.state, this.files);
      this.onChangeEmitter.trigger(elements, this.state, this.files);
    }
  }

  private renderInteractiveSceneCallback = ({
    atLeastOneVisibleElement,
    scrollBars,
    elementsMap,
  }: RenderInteractiveSceneCallback) => {
    if (scrollBars) {
      currentScrollBars = scrollBars;
    }
    const scrolledOutside =
      // hide when editing text
      this.state.editingTextElement
        ? false
        : !atLeastOneVisibleElement && elementsMap.size > 0;
    if (this.state.scrolledOutside !== scrolledOutside) {
      this.setState({ scrolledOutside });
    }

    this.scheduleImageRefresh();
  };

  private onScroll = debounce(
    () => scrollOps.onScroll(this.engineContext),
    SCROLL_TIMEOUT,
  );

  // Copy/paste

  private onCut = withBatchedUpdates((event: ClipboardEvent) =>
    clipboardOps.onCut(this.engineContext, event),
  );

  private onCopy = withBatchedUpdates((event: ClipboardEvent) =>
    clipboardOps.onCopy(this.engineContext, event),
  );

  private onTouchStart = (event: TouchEvent) =>
    gestureOps.onTouchStart(this.engineContext, event);

  private onTouchEnd = (event: TouchEvent) =>
    gestureOps.onTouchEnd(this.engineContext, event);

  // TODO: Cover with tests
  private async insertClipboardContent(
    data: ClipboardData,
    dataTransferFiles: ParsedDataTransferFile[],
    isPlainPaste: boolean,
  ) {
    return clipboardOps.insertClipboardContent(
      this.engineContext,
      data,
      dataTransferFiles,
      isPlainPaste,
    );
  }

  public pasteFromClipboard = withBatchedUpdates(
    async (event: ClipboardEvent) =>
      clipboardOps.pasteFromClipboard(this.engineContext, event),
  );

  addElementsFromPasteOrLibrary = (opts: {
    elements: readonly ExcalidrawElement[];
    files: BinaryFiles | null;
    position: { clientX: number; clientY: number } | "cursor" | "center";
    retainSeed?: boolean;
    fitToContent?: boolean;
  }) => clipboardOps.addElementsFromPasteOrLibrary(this.engineContext, opts);

  // TODO rewrite this to paste both text & images at the same time if
  // pasted data contains both
  private async addElementsFromMixedContentPaste(
    mixedContent: PastedMixedContent,
    {
      isPlainPaste,
      sceneX,
      sceneY,
    }: { isPlainPaste: boolean; sceneX: number; sceneY: number },
  ) {
    return clipboardOps.addElementsFromMixedContentPaste(
      this.engineContext,
      mixedContent,
      { isPlainPaste, sceneX, sceneY },
    );
  }

  private addTextFromPaste(text: string, isPlainPaste = false) {
    return clipboardOps.addTextFromPaste(this.engineContext, text, isPlainPaste);
  }

  setAppState: React.Component<any, AppState>["setState"] = (
    state,
    callback,
  ) => {
    this.setState(state, callback);
  };

  removePointer = (event: React.PointerEvent<HTMLElement> | PointerEvent) => {
    if (touchTimeout) {
      this.resetContextMenuTimer();
    }

    gesture.pointers.delete(event.pointerId);
  };

  toggleLock = (source: "keyboard" | "ui" = "ui") => {
    if (!this.state.activeTool.locked) {
      trackEvent(
        "toolbar",
        "toggleLock",
        `${source} (${
          this.editorInterface.formFactor === "phone" ? "mobile" : "desktop"
        })`,
      );
    }
    this.setState((prevState) => {
      return {
        activeTool: {
          ...prevState.activeTool,
          ...updateActiveTool(
            this.state,
            prevState.activeTool.locked
              ? { type: this.state.preferredSelectionTool.type }
              : prevState.activeTool,
          ),
          locked: !prevState.activeTool.locked,
        },
      };
    });
  };

  updateFrameRendering = (
    opts:
      | Partial<AppState["frameRendering"]>
      | ((
          prevState: AppState["frameRendering"],
        ) => Partial<AppState["frameRendering"]>),
  ) => {
    this.setState((prevState) => {
      const next =
        typeof opts === "function" ? opts(prevState.frameRendering) : opts;
      return {
        frameRendering: {
          enabled: next?.enabled ?? prevState.frameRendering.enabled,
          clip: next?.clip ?? prevState.frameRendering.clip,
          name: next?.name ?? prevState.frameRendering.name,
          outline: next?.outline ?? prevState.frameRendering.outline,
        },
      };
    });
  };

  togglePenMode = (force: boolean | null) =>
    gestureOps.togglePenMode(this.engineContext, force);

  onHandToolToggle = () => {
    this.actionManager.executeAction(actionToggleHandTool);
  };

  /**
   * Zooms on canvas viewport center
   */
  zoomCanvas = (
    /**
     * Decimal fraction, auto-clamped between MIN_ZOOM and MAX_ZOOM.
     * 1 = 100% zoom, 2 = 200% zoom, 0.5 = 50% zoom
     */
    value: number,
  ) => scrollOps.zoomCanvas(this.engineContext, value);

  private cancelInProgressAnimation: (() => void) | null = null;

  scrollToContent = (
    /**
     * target to scroll to
     *
     * - string - id of element or group, or url containing elementLink
     * - ExcalidrawElement | ExcalidrawElement[] - element(s) objects
     */
    target:
      | string
      | ExcalidrawElement
      | readonly ExcalidrawElement[] = this.scene.getNonDeletedElements(),
    opts?: (
      | {
          fitToContent?: boolean;
          fitToViewport?: never;
          viewportZoomFactor?: number;
          animate?: boolean;
          duration?: number;
        }
      | {
          fitToContent?: never;
          fitToViewport?: boolean;
          /** when fitToViewport=true, how much screen should the content cover,
           * between 0.1 (10%) and 1 (100%)
           */
          viewportZoomFactor?: number;
          animate?: boolean;
          duration?: number;
        }
    ) & {
      minZoom?: number;
      maxZoom?: number;
      canvasOffsets?: Offsets;
    },
  ) => {
    if (typeof target === "string") {
      let id: string | null;
      if (isElementLink(target)) {
        id = parseElementLinkFromURL(target);
      } else {
        id = target;
      }
      if (id) {
        const elements = this.scene.getElementsFromId(id);

        if (elements?.length) {
          this.scrollToContent(elements, {
            fitToContent: opts?.fitToContent ?? true,
            animate: opts?.animate ?? true,
          });
        } else if (isElementLink(target)) {
          this.setState({
            toast: {
              message: t("elementLink.notFound"),
              duration: 3000,
              closable: true,
            },
          });
        }
      }
      return;
    }

    this.cancelInProgressAnimation?.();

    // convert provided target into ExcalidrawElement[] if necessary
    const targetElements = Array.isArray(target) ? target : [target];

    let zoom = this.state.zoom;
    let scrollX = this.state.scrollX;
    let scrollY = this.state.scrollY;

    if (opts?.fitToContent || opts?.fitToViewport) {
      const { appState } = zoomToFit({
        canvasOffsets: opts.canvasOffsets,
        targetElements,
        appState: this.state,
        fitToViewport: !!opts?.fitToViewport,
        viewportZoomFactor: opts?.viewportZoomFactor,
        minZoom: opts?.minZoom,
        maxZoom: opts?.maxZoom,
      });
      zoom = appState.zoom;
      scrollX = appState.scrollX;
      scrollY = appState.scrollY;
    } else {
      // compute only the viewport location, without any zoom adjustment
      const scroll = calculateScrollCenter(targetElements, this.state);
      scrollX = scroll.scrollX;
      scrollY = scroll.scrollY;
    }

    // when animating, we use RequestAnimationFrame to prevent the animation
    // from slowing down other processes
    if (opts?.animate) {
      const origScrollX = this.state.scrollX;
      const origScrollY = this.state.scrollY;
      const origZoom = this.state.zoom.value;

      const cancel = easeToValuesRAF({
        fromValues: {
          scrollX: origScrollX,
          scrollY: origScrollY,
          zoom: origZoom,
        },
        toValues: { scrollX, scrollY, zoom: zoom.value },
        interpolateValue: (from, to, progress, key) => {
          // for zoom, use different easing
          if (key === "zoom") {
            return from * Math.pow(to / from, easeOut(progress));
          }
          // handle using default
          return undefined;
        },
        onStep: ({ scrollX, scrollY, zoom }) => {
          this.setState({
            scrollX,
            scrollY,
            zoom: { value: zoom },
          });
        },
        onStart: () => {
          this.setState({ shouldCacheIgnoreZoom: true });
        },
        onEnd: () => {
          this.setState({ shouldCacheIgnoreZoom: false });
        },
        onCancel: () => {
          this.setState({ shouldCacheIgnoreZoom: false });
        },
        duration: opts?.duration ?? 500,
      });

      this.cancelInProgressAnimation = () => {
        cancel();
        this.cancelInProgressAnimation = null;
      };
    } else {
      this.setState({ scrollX, scrollY, zoom });
    }
  };

  private maybeUnfollowRemoteUser = () => {
    if (this.state.userToFollow) {
      this.setState({ userToFollow: null });
    }
  };

  /** use when changing scrollX/scrollY/zoom based on user interaction */
  private translateCanvas: React.Component<any, AppState>["setState"] = (
    state,
  ) =>
    scrollOps.translateCanvas(
      this.engineContext,
      state as
        | Partial<AppState>
        | ((prevState: AppState) => Partial<AppState> | null),
    );

  setToast = (toast: AppState["toast"]) => {
    this.setState({ toast });
  };

  restoreFileFromShare = async () => {
    try {
      const webShareTargetCache = await caches.open("web-share-target");

      const response = await webShareTargetCache.match("shared-file");
      if (response) {
        const blob = await response.blob();
        const file = new File([blob], blob.name || "", { type: blob.type });
        this.loadFileToCanvas(file, null);
        await webShareTargetCache.delete("shared-file");
        window.history.replaceState(null, APP_NAME, window.location.pathname);
      }
    } catch (error: any) {
      this.setState({ errorMessage: error.message });
    }
  };

  /**
   * adds supplied files to existing files in the appState.
   * NOTE if file already exists in editor state, the file data is not updated
   * */
  public addFiles: ExcalidrawImperativeAPI["addFiles"] = withBatchedUpdates(
    (files) => {
      const { addedFiles } = this.addMissingFiles(files);

      this.clearImageShapeCache(addedFiles);
      this.scene.triggerUpdate();

      this.addNewImagesToImageCache();
    },
  );

  private addMissingFiles = (
    files: BinaryFiles | BinaryFileData[],
    replace = false,
  ) => {
    const nextFiles = replace ? {} : { ...this.files };
    const addedFiles: BinaryFiles = {};

    const _files = Array.isArray(files) ? files : Object.values(files);

    for (const fileData of _files) {
      if (nextFiles[fileData.id]) {
        continue;
      }

      addedFiles[fileData.id] = fileData;
      nextFiles[fileData.id] = fileData;

      if (fileData.mimeType === MIME_TYPES.svg) {
        try {
          const restoredDataURL = getDataURL_sync(
            normalizeSVG(dataURLToString(fileData.dataURL)),
            MIME_TYPES.svg,
          );
          if (fileData.dataURL !== restoredDataURL) {
            // bump version so persistence layer can update the store
            fileData.version = (fileData.version ?? 1) + 1;
            fileData.dataURL = restoredDataURL;
          }
        } catch (error) {
          console.error(error);
        }
      }
    }

    this.files = nextFiles;

    return { addedFiles };
  };

  public updateScene = withBatchedUpdates(
    <K extends keyof AppState>(sceneData: {
      elements?: SceneData["elements"];
      appState?: Pick<AppState, K> | null;
      collaborators?: SceneData["collaborators"];
      /**
       *  Controls which updates should be captured by the `Store`. Captured updates are emmitted and listened to by other components, such as `History` for undo / redo purposes.
       *
       *  - `CaptureUpdateAction.IMMEDIATELY`: Updates are immediately undoable. Use for most local updates.
       *  - `CaptureUpdateAction.NEVER`: Updates never make it to undo/redo stack. Use for remote updates or scene initialization.
       *  - `CaptureUpdateAction.EVENTUALLY`: Updates will be eventually be captured as part of a future increment.
       *
       * Check [API docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#captureUpdate) for more details.
       *
       * @default CaptureUpdateAction.EVENTUALLY
       */
      captureUpdate?: SceneData["captureUpdate"];
    }) => {
      const { elements, appState, collaborators, captureUpdate } = sceneData;

      if (captureUpdate) {
        const nextElements = elements ? elements : undefined;
        const observedAppState = appState
          ? getObservedAppState({
              ...this.store.snapshot.appState,
              ...appState,
            })
          : undefined;

        this.store.scheduleMicroAction({
          action: captureUpdate,
          elements: nextElements,
          appState: observedAppState,
        });
      }

      if (appState) {
        this.setState(appState as Pick<AppState, K> | null);
      }

      if (elements) {
        this.scene.replaceAllElements(elements);
      }

      if (collaborators) {
        this.setState({ collaborators });
      }
    },
  );

  public applyDeltas = (
    deltas: StoreDelta[],
    options?: ApplyToOptions,
  ): [SceneElementsMap, AppState, boolean] => {
    // squash all deltas together, starting with a fresh new delta instance
    const aggregatedDelta = StoreDelta.squash(...deltas);

    // create new instance of elements map & appState, so we don't accidentaly mutate existing ones
    const nextAppState = { ...this.state };
    const nextElements = new Map(
      this.scene.getElementsMapIncludingDeleted(),
    ) as SceneElementsMap;

    return StoreDelta.applyTo(
      aggregatedDelta,
      nextElements,
      nextAppState,
      options,
    );
  };

  public mutateElement = <TElement extends Mutable<ExcalidrawElement>>(
    element: TElement,
    updates: ElementUpdate<TElement>,
    informMutation = true,
  ) => {
    return this.scene.mutateElement(element, updates, {
      informMutation,
      isDragging: false,
    });
  };

  private triggerRender = (
    /** force always re-renders canvas even if no change */
    force?: boolean,
  ) => {
    if (force === true) {
      this.scene.triggerUpdate();
    } else {
      this.setState({});
    }
  };

  /**
   * @returns whether the menu was toggled on or off
   */
  public toggleSidebar = ({
    name,
    tab,
    force,
  }: {
    name: SidebarName | null;
    tab?: SidebarTabName;
    force?: boolean;
  }): boolean => {
    let nextName;
    if (force === undefined) {
      nextName =
        this.state.openSidebar?.name === name &&
        this.state.openSidebar?.tab === tab
          ? null
          : name;
    } else {
      nextName = force ? name : null;
    }

    const nextState: AppState["openSidebar"] = nextName
      ? { name: nextName }
      : null;
    if (nextState && tab) {
      nextState.tab = tab;
    }

    this.setState({ openSidebar: nextState });

    return !!nextName;
  };

  private updateCurrentCursorPosition = withBatchedUpdates(
    (event: MouseEvent) => {
      this.lastViewportPosition.x = event.clientX;
      this.lastViewportPosition.y = event.clientY;
    },
  );

  public getEditorUIOffsets = (): Offsets => {
    const toolbarBottom =
      this.excalidrawContainerRef?.current
        ?.querySelector(".App-toolbar")
        ?.getBoundingClientRect()?.bottom ?? 0;
    const sidebarRect = this.excalidrawContainerRef?.current
      ?.querySelector(".sidebar")
      ?.getBoundingClientRect();
    const propertiesPanelRect = this.excalidrawContainerRef?.current
      ?.querySelector(".App-menu__left")
      ?.getBoundingClientRect();

    const PADDING = 16;

    return getLanguage().rtl
      ? {
          top: toolbarBottom + PADDING,
          right:
            Math.max(
              this.state.width -
                (propertiesPanelRect?.left ?? this.state.width),
              0,
            ) + PADDING,
          bottom: PADDING,
          left: Math.max(sidebarRect?.right ?? 0, 0) + PADDING,
        }
      : {
          top: toolbarBottom + PADDING,
          right: Math.max(
            this.state.width -
              (sidebarRect?.left ?? this.state.width) +
              PADDING,
            0,
          ),
          bottom: PADDING,
          left: Math.max(propertiesPanelRect?.right ?? 0, 0) + PADDING,
        };
  };

  // Input handling
  private onKeyDown = withBatchedUpdates(
    (event: React.KeyboardEvent | KeyboardEvent) =>
      keyboardOps.onKeyDown(this.engineContext, event),
  );

  private onKeyUp = withBatchedUpdates((event: KeyboardEvent) =>
    keyboardOps.onKeyUp(this.engineContext, event),
  );

  // We purposely widen the `tool` type so this helper can be called with
  // any tool without having to type check it
  private isToolSupported = <T extends ToolType | "custom">(tool: T) => {
    return (
      this.props.UIOptions.tools?.[
        tool as Extract<T, keyof AppProps["UIOptions"]["tools"]>
      ] !== false
    );
  };

  setActiveTool = (
    tool: ({ type: ToolType } | { type: "custom"; customType: string }) & {
      locked?: boolean;
      fromSelection?: boolean;
    },
    keepSelection = false,
  ) => {
    if (!this.isToolSupported(tool.type)) {
      console.warn(
        `"${tool.type}" tool is disabled via "UIOptions.canvasActions.tools.${tool.type}"`,
      );
      return;
    }

    const nextActiveTool = updateActiveTool(this.state, tool);
    if (nextActiveTool.type === "hand") {
      setCursor(this.interactiveCanvas, CURSOR_TYPE.GRAB);
    } else if (!isHoldingSpace) {
      setCursorForShape(this.interactiveCanvas, {
        ...this.state,
        activeTool: nextActiveTool,
      });
    }
    if (isToolIcon(document.activeElement)) {
      this.focusContainer();
    }
    if (!isLinearElementType(nextActiveTool.type)) {
      this.setState({ suggestedBinding: null });
    }
    if (nextActiveTool.type === "image") {
      this.onImageToolbarButtonClick();
    }

    this.setState((prevState) => {
      const commonResets = {
        snapLines: prevState.snapLines.length ? [] : prevState.snapLines,
        originSnapOffset: null,
        activeEmbeddable: null,
        selectedLinearElement: isSelectionLikeTool(nextActiveTool.type)
          ? prevState.selectedLinearElement
          : null,
      } as const;

      if (nextActiveTool.type === "freedraw") {
        this.store.scheduleCapture();
      }

      if (nextActiveTool.type === "lasso") {
        return {
          ...prevState,
          ...commonResets,
          activeTool: nextActiveTool,
          ...(keepSelection
            ? {}
            : {
                selectedElementIds: makeNextSelectedElementIds({}, prevState),
                selectedGroupIds: makeNextSelectedElementIds({}, prevState),
                editingGroupId: null,
                multiElement: null,
              }),
        };
      } else if (nextActiveTool.type !== "selection") {
        return {
          ...prevState,
          ...commonResets,
          activeTool: nextActiveTool,
          selectedElementIds: makeNextSelectedElementIds({}, prevState),
          selectedGroupIds: makeNextSelectedElementIds({}, prevState),
          editingGroupId: null,
          multiElement: null,
        };
      }
      return {
        ...prevState,
        ...commonResets,
        activeTool: nextActiveTool,
      };
    });
  };

  setOpenDialog = (dialogType: AppState["openDialog"]) => {
    this.setState({ openDialog: dialogType });
  };

  private setCursor = (cursor: string) => {
    setCursor(this.interactiveCanvas, cursor);
  };

  private resetCursor = () => {
    resetCursor(this.interactiveCanvas);
  };
  /**
   * returns whether user is making a gesture with >= 2 fingers (points)
   * on o touch screen (not on a trackpad). Currently only relates to Darwin
   * (iOS/iPadOS,MacOS), but may work on other devices in the future if
   * GestureEvent is standardized.
   */
  private isTouchScreenMultiTouchGesture = () =>
    gestureOps.isTouchScreenMultiTouchGesture(this.engineContext);

  public getName = () => {
    return (
      this.state.name ||
      this.props.name ||
      `${t("labels.untitled")}-${getDateTime()}`
    );
  };

  // fires only on Safari
  private onGestureStart = withBatchedUpdates((event: GestureEvent) =>
    gestureOps.onGestureStart(this.engineContext, event),
  );

  // fires only on Safari
  private onGestureChange = withBatchedUpdates((event: GestureEvent) =>
    gestureOps.onGestureChange(this.engineContext, event),
  );

  // fires only on Safari
  private onGestureEnd = withBatchedUpdates((event: GestureEvent) =>
    gestureOps.onGestureEnd(this.engineContext, event),
  );

  private handleTextWysiwyg(
    element: ExcalidrawTextElement,
    {
      isExistingElement = false,
      initialCaretSceneCoords = null,
    }: {
      isExistingElement?: boolean;
      /**
       * supply null if no caret positioning is desired, and instead
       * text should be auto-selected
       */
      initialCaretSceneCoords?: { x: number; y: number } | null;
    },
  ) {
    const elementsMap = this.scene.getElementsMapIncludingDeleted();

    const updateElement = (nextOriginalText: string, isDeleted: boolean) => {
      this.scene.replaceAllElements([
        // Not sure why we include deleted elements as well hence using deleted elements map
        ...this.scene.getElementsIncludingDeleted().map((_element) => {
          if (_element.id === element.id && isTextElement(_element)) {
            return newElementWith(_element, {
              originalText: nextOriginalText,
              isDeleted: isDeleted ?? _element.isDeleted,
              // returns (wrapped) text and new dimensions
              ...refreshTextDimensions(
                _element,
                getContainerElement(_element, elementsMap),
                elementsMap,
                nextOriginalText,
              ),
            });
          }
          return _element;
        }),
      ]);
    };

    textWysiwyg({
      id: element.id,
      canvas: this.canvas,
      getViewportCoords: (x, y) => {
        const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
          {
            sceneX: x,
            sceneY: y,
          },
          this.state,
        );
        return [
          viewportX - this.state.offsetLeft,
          viewportY - this.state.offsetTop,
        ];
      },
      onChange: withBatchedUpdates((nextOriginalText) => {
        updateElement(nextOriginalText, false);
        if (isNonDeletedElement(element)) {
          updateBoundElements(element, this.scene);
        }
      }),
      onSubmit: withBatchedUpdates(({ viaKeyboard, nextOriginalText }) => {
        const isDeleted = !nextOriginalText.trim();
        updateElement(nextOriginalText, isDeleted);

        // keyboard-submit keeps focus on the edited object. For bound text, keep
        // the container selected even if the text becomes empty and is deleted.
        const elementIdToSelect = viaKeyboard
          ? element.containerId || (!isDeleted ? element.id : null)
          : null;

        if (elementIdToSelect) {
          // needed to ensure state is updated before "finalize" action
          // that's invoked on keyboard-submit as well
          // TODO either move this into finalize as well, or handle all state
          // updates in one place, skipping finalize action
          flushSync(() => {
            this.setState((prevState) => ({
              selectedElementIds: makeNextSelectedElementIds(
                {
                  ...prevState.selectedElementIds,
                  [elementIdToSelect]: true,
                },
                prevState,
              ),
            }));
          });
        }

        if (isDeleted) {
          fixBindingsAfterDeletion(this.scene.getNonDeletedElements(), [
            element,
          ]);
        }

        if (!isDeleted || isExistingElement) {
          this.store.scheduleCapture();
        }

        flushSync(() => {
          this.setState({
            newElement: null,
            editingTextElement: null,
          });
        });

        if (this.state.activeTool.locked) {
          setCursorForShape(this.interactiveCanvas, this.state);
        }

        this.focusContainer();
      }),
      element,
      excalidrawContainer: this.excalidrawContainerRef.current,
      app: this,
      initialCaretSceneCoords,
      // when text is selected, it's hard (at least on iOS) to re-position the
      // caret (i.e. deselect). There's not much use for always selecting
      // the text on edit anyway (and users can select-all from contextmenu
      // if needed)
      autoSelect: !this.editorInterface.isTouchScreen,
    });
    // deselect all other elements when inserting text
    this.deselectElements();

    // do an initial update to re-initialize element position since we were
    // modifying element's x/y for sake of editor (case: syncing to remote)
    updateElement(element.originalText, false);
  }

  private deselectElements() {
    this.setState({
      selectedElementIds: makeNextSelectedElementIds({}, this.state),
      selectedGroupIds: {},
      editingGroupId: null,
      activeEmbeddable: null,
    });
  }

  private getSelectedTextElement(
    container?: ExcalidrawTextContainer | null,
  ): NonDeleted<ExcalidrawTextElement> | null {
    return textOps.getSelectedTextElement(this.engineContext, container);
  }

  private getSelectedTextEditingContainerAtPosition(
    hitElement: NonDeletedExcalidrawElement | null,
    sceneCoords: { x: number; y: number },
  ): ExcalidrawTextContainer | null | undefined {
    return textOps.getSelectedTextEditingContainerAtPosition(
      this.engineContext,
      hitElement,
      sceneCoords,
    );
  }

  private getTextElementAtPosition(
    x: number,
    y: number,
  ): NonDeleted<ExcalidrawTextElement> | null {
    return textOps.getTextElementAtPosition(this.engineContext, x, y);
  }

  private isHittingTextAutoResizeHandle = (
    selectedElements: NonDeleted<ExcalidrawElement>[],
    point: Readonly<{ x: number; y: number }>,
  ): boolean =>
    textOps.isHittingTextAutoResizeHandle(
      this.engineContext,
      selectedElements,
      point,
    );

  private handleTextAutoResizeHandlePointerDown = (
    selectedElements: NonDeleted<ExcalidrawElement>[],
    point: Readonly<{ x: number; y: number }>,
  ) =>
    textOps.handleTextAutoResizeHandlePointerDown(
      this.engineContext,
      selectedElements,
      point,
    );

  private getElementAtPosition(
    x: number,
    y: number,
    opts?: (
      | {
          includeBoundTextElement?: boolean;
          includeLockedElements?: boolean;
        }
      | {
          allHitElements: NonDeleted<ExcalidrawElement>[];
        }
    ) & {
      preferSelected?: boolean;
    },
  ): NonDeleted<ExcalidrawElement> | null {
    return textOps.getElementAtPosition(this.engineContext, x, y, opts);
  }

  private getElementsAtPosition(
    x: number,
    y: number,
    opts?: {
      includeBoundTextElement?: boolean;
      includeLockedElements?: boolean;
    },
  ): NonDeleted<ExcalidrawElement>[] {
    return textOps.getElementsAtPosition(this.engineContext, x, y, opts);
  }

  getElementHitThreshold(element: ExcalidrawElement) {
    return textOps.getElementHitThreshold(this.engineContext, element);
  }

  private hitElement(
    x: number,
    y: number,
    element: ExcalidrawElement,
    considerBoundingBox = true,
  ) {
    return textOps.hitElement(
      this.engineContext,
      x,
      y,
      element,
      considerBoundingBox,
    );
  }

  private getTextBindableContainerAtPosition(x: number, y: number) {
    return textOps.getTextBindableContainerAtPosition(this.engineContext, x, y);
  }

  private startTextEditing = (opts: {
    sceneX: number;
    sceneY: number;
    insertAtParentCenter?: boolean;
    container?: ExcalidrawTextContainer | null;
    autoEdit?: boolean;
    initialCaretSceneCoords?: { x: number; y: number };
  }) => textOps.startTextEditing(this.engineContext, opts);

  private startImageCropping = (image: ExcalidrawImageElement) =>
    imageEraseOps.startImageCropping(this.engineContext, image);

  private finishImageCropping = () =>
    imageEraseOps.finishImageCropping(this.engineContext);

  private handleCanvasDoubleClick = (
    event: Pick<
      React.MouseEvent<HTMLCanvasElement>,
      | "type"
      | "clientX"
      | "clientY"
      | "altKey"
      | "ctrlKey"
      | "metaKey"
      | "shiftKey"
    >,
  ) => canvasEventOps.handleCanvasDoubleClick(this.engineContext, event);


  private handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) =>
    canvasEventOps.handleCanvasClick(this.engineContext, event);

  private getElementLinkAtPosition = (
    scenePointer: Readonly<{ x: number; y: number }>,
    hitElementMightBeLocked: NonDeletedExcalidrawElement | null,
  ): ExcalidrawElement | undefined => {
    if (hitElementMightBeLocked && hitElementMightBeLocked.locked) {
      return undefined;
    }

    const elements = this.scene.getNonDeletedElements();
    let hitElementIndex = -1;

    for (let index = elements.length - 1; index >= 0; index--) {
      const element = elements[index];
      if (
        hitElementMightBeLocked &&
        element.id === hitElementMightBeLocked.id
      ) {
        hitElementIndex = index;
      }
      if (
        element.link &&
        index >= hitElementIndex &&
        isPointHittingLink(
          element,
          this.scene.getNonDeletedElementsMap(),
          this.state,
          pointFrom(scenePointer.x, scenePointer.y),
          this.editorInterface.formFactor === "phone",
        )
      ) {
        return element;
      }
    }
  };

  private handleElementLinkClick = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => canvasEventOps.handleElementLinkClick(this.engineContext, event);

  private getTopLayerFrameAtSceneCoords = (sceneCoords: {
    x: number;
    y: number;
  }) => bindFrameOps.getTopLayerFrameAtSceneCoords(this.engineContext, sceneCoords);

  private handleCanvasPointerMove = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => pointerEventOps.handleCanvasPointerMove(this.engineContext, event);


  private handleEraser = (
    event: PointerEvent,
    scenePointer: { x: number; y: number },
  ) =>
    pointerHelperOps.handleEraser(this.engineContext, event, scenePointer);

  // set touch moving for mobile context menu
  private handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) =>
    gestureOps.handleTouchMove(this.engineContext, event);

  handleHoverSelectedLinearElement(
    linearElementEditor: LinearElementEditor,
    scenePointerX: number,
    scenePointerY: number,
  ) {
    return linearHoverContextOps.handleHoverSelectedLinearElement(
      this.engineContext,
      linearElementEditor,
      scenePointerX,
      scenePointerY,
    );
  }


  private handleCanvasPointerDown = (
    event: React.PointerEvent<HTMLElement>,
  ) => pointerEventOps.handleCanvasPointerDown(this.engineContext, event);


  private handleCanvasPointerUp = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => canvasEventOps.handleCanvasPointerUp(this.engineContext, event);

  private maybeOpenContextMenuAfterPointerDownOnTouchDevices = (
    event: React.PointerEvent<HTMLElement>,
  ): void => {
    // deal with opening context menu on touch devices
    if (event.pointerType === "touch") {
      invalidateContextMenu = false;

      if (touchTimeout) {
        // If there's already a touchTimeout, this means that there's another
        // touch down and we are doing another touch, so we shouldn't open the
        // context menu.
        invalidateContextMenu = true;
      } else {
        // open the context menu with the first touch's clientX and clientY
        // if the touch is not moving
        touchTimeout = window.setTimeout(() => {
          touchTimeout = 0;
          if (!invalidateContextMenu) {
            this.handleCanvasContextMenu(event);
          }
        }, TOUCH_CTX_MENU_TIMEOUT);
      }
    }
  };

  private resetContextMenuTimer = () => {
    clearTimeout(touchTimeout);
    touchTimeout = 0;
    invalidateContextMenu = false;
  };

  /**
   * pointerup may not fire in certian cases (user tabs away...), so in order
   * to properly cleanup pointerdown state, we need to fire any hanging
   * pointerup handlers manually
   */
  private maybeCleanupAfterMissingPointerUp = (event: PointerEvent | null) => {
    lastPointerUp?.();
    this.missingPointerEventCleanupEmitter.trigger(event).clear();
  };

  // Returns whether the event is a panning
  public handleCanvasPanUsingWheelOrSpaceDrag = (
    event: React.PointerEvent<HTMLElement> | MouseEvent,
  ): boolean =>
    scrollOps.handleCanvasPanUsingWheelOrSpaceDrag(this.engineContext, event);

  private updateGestureOnPointerDown(
    event: React.PointerEvent<HTMLElement>,
  ): void {
    gesture.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (gesture.pointers.size === 2) {
      gesture.lastCenter = getCenter(gesture.pointers);
      gesture.initialScale = this.state.zoom.value;
      gesture.initialDistance = getDistance(
        Array.from(gesture.pointers.values()),
      );
    }
  }

  private initialPointerDownState(
    event: React.PointerEvent<HTMLElement>,
  ): PointerDownState {
    const origin = viewportCoordsToSceneCoords(event, this.state);
    const selectedElements = this.scene.getSelectedElements(this.state);
    const [minX, minY, maxX, maxY] = getCommonBounds(selectedElements);
    const isElbowArrowOnly = selectedElements.findIndex(isElbowArrow) === 0;

    return {
      origin,
      withCmdOrCtrl: event[KEYS.CTRL_OR_CMD],
      originInGrid: tupleToCoors(
        getGridPoint(
          origin.x,
          origin.y,
          event[KEYS.CTRL_OR_CMD] || isElbowArrowOnly
            ? null
            : this.getEffectiveGridSize(),
        ),
      ),
      scrollbars: isOverScrollBars(
        currentScrollBars,
        event.clientX - this.state.offsetLeft,
        event.clientY - this.state.offsetTop,
      ),
      // we need to duplicate because we'll be updating this state
      lastCoords: { ...origin },
      originalElements: this.scene
        .getNonDeletedElements()
        .reduce((acc, element) => {
          acc.set(element.id, deepCopyElement(element));
          return acc;
        }, new Map() as PointerDownState["originalElements"]),
      resize: {
        handleType: false,
        isResizing: false,
        offset: { x: 0, y: 0 },
        arrowDirection: "origin",
        center: { x: (maxX + minX) / 2, y: (maxY + minY) / 2 },
      },
      hit: {
        element: null,
        allHitElements: [],
        wasAddedToSelection: false,
        hasBeenDuplicated: false,
        hasHitCommonBoundingBoxOfSelectedElements:
          this.isHittingCommonBoundingBoxOfSelectedElements(
            origin,
            selectedElements,
          ),
      },
      drag: {
        hasOccurred: false,
        offset: null,
        origin: { ...origin },
        blockDragging: false,
      },
      eventListeners: {
        onMove: null,
        onUp: null,
        onKeyUp: null,
        onKeyDown: null,
      },
      boxSelection: {
        hasOccurred: false,
      },
    };
  }

  // Returns whether the event is a dragging a scrollbar
  private handleDraggingScrollBar(
    event: React.PointerEvent<HTMLElement>,
    pointerDownState: PointerDownState,
  ): boolean {
    if (
      !(pointerDownState.scrollbars.isOverEither && !this.state.multiElement)
    ) {
      return false;
    }
    isDraggingScrollBar = true;
    pointerDownState.lastCoords.x = event.clientX;
    pointerDownState.lastCoords.y = event.clientY;
    const onPointerMove = withBatchedUpdatesThrottled((event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      this.handlePointerMoveOverScrollbars(event, pointerDownState);
    });
    const onPointerUp = withBatchedUpdates(() => {
      lastPointerUp = null;
      isDraggingScrollBar = false;
      setCursorForShape(this.interactiveCanvas, this.state);
      this.setState({
        cursorButton: "up",
      });
      this.savePointer(event.clientX, event.clientY, "up");
      window.removeEventListener(EVENT.POINTER_MOVE, onPointerMove);
      window.removeEventListener(EVENT.POINTER_UP, onPointerUp);
      onPointerMove.flush();
    });

    lastPointerUp = onPointerUp;

    window.addEventListener(EVENT.POINTER_MOVE, onPointerMove);
    window.addEventListener(EVENT.POINTER_UP, onPointerUp);
    return true;
  }

  private clearSelectionIfNotUsingSelection = (): void => {
    if (!isSelectionLikeTool(this.state.activeTool.type)) {
      this.setState({
        selectedElementIds: makeNextSelectedElementIds({}, this.state),
        selectedGroupIds: {},
        editingGroupId: null,
        activeEmbeddable: null,
      });
    }
  };

  private handleSelectionOnPointerDown = (
    event: React.PointerEvent<HTMLElement>,
    pointerDownState: PointerDownState,
  ): boolean =>
    pointerDownSubOps.handleSelectionOnPointerDown(
      this.engineContext,
      event,
      pointerDownState,
    );

  private isASelectedElement(hitElement: ExcalidrawElement | null): boolean {
    return hitElement != null && this.state.selectedElementIds[hitElement.id];
  }

  private isHittingCommonBoundingBoxOfSelectedElements(
    point: Readonly<{ x: number; y: number }>,
    selectedElements: readonly ExcalidrawElement[],
  ): boolean {
    if (selectedElements.length < 2) {
      return false;
    }

    // How many pixels off the shape boundary we still consider a hit
    const threshold = Math.max(
      DEFAULT_COLLISION_THRESHOLD / this.state.zoom.value,
      1,
    );
    const boundsPadding =
      (DEFAULT_TRANSFORM_HANDLE_SPACING * 2) / this.state.zoom.value;
    const [x1, y1, x2, y2] = getCommonBounds(selectedElements);
    return (
      point.x > x1 - boundsPadding - threshold &&
      point.x < x2 + boundsPadding + threshold &&
      point.y > y1 - boundsPadding - threshold &&
      point.y < y2 + boundsPadding + threshold
    );
  }

  private handleTextOnPointerDown = (
    event: React.PointerEvent<HTMLElement>,
    pointerDownState: PointerDownState,
  ): void =>
    pointerDownSubOps.handleTextOnPointerDown(
      this.engineContext,
      event,
      pointerDownState,
    );

  private handleFreeDrawElementOnPointerDown = (
    event: React.PointerEvent<HTMLElement>,
    elementType: ExcalidrawFreeDrawElement["type"],
    pointerDownState: PointerDownState,
  ) =>
    pointerDownSubOps.handleFreeDrawElementOnPointerDown(
      this.engineContext,
      event,
      elementType,
      pointerDownState,
    );

  public insertIframeElement = ({
    sceneX,
    sceneY,
    width,
    height,
  }: {
    sceneX: number;
    sceneY: number;
    width: number;
    height: number;
  }) => {
    const [gridX, gridY] = getGridPoint(
      sceneX,
      sceneY,
      this.lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
        ? null
        : this.getEffectiveGridSize(),
    );

    const element = newIframeElement({
      type: "iframe",
      x: gridX,
      y: gridY,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      fillStyle: this.state.currentItemFillStyle,
      strokeWidth: this.state.currentItemStrokeWidth,
      strokeStyle: this.state.currentItemStrokeStyle,
      roughness: this.state.currentItemRoughness,
      roundness: this.getCurrentItemRoundness("iframe"),
      opacity: this.state.currentItemOpacity,
      locked: false,
      width,
      height,
    });

    this.scene.insertElement(element);

    return element;
  };

  //create rectangle element with youtube top left on nearest grid point width / hight 640/360
  public insertEmbeddableElement = ({
    sceneX,
    sceneY,
    link,
  }: {
    sceneX: number;
    sceneY: number;
    link: string;
  }) => {
    const [gridX, gridY] = getGridPoint(
      sceneX,
      sceneY,
      this.lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
        ? null
        : this.getEffectiveGridSize(),
    );

    const embedLink = getEmbedLink(link);

    if (!embedLink) {
      return;
    }

    if (embedLink.error instanceof URIError) {
      this.setToast({
        message: t("toast.unrecognizedLinkFormat"),
        closable: true,
      });
    }

    const element = newEmbeddableElement({
      type: "embeddable",
      x: gridX,
      y: gridY,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      fillStyle: this.state.currentItemFillStyle,
      strokeWidth: this.state.currentItemStrokeWidth,
      strokeStyle: this.state.currentItemStrokeStyle,
      roughness: this.state.currentItemRoughness,
      roundness: this.getCurrentItemRoundness("embeddable"),
      opacity: this.state.currentItemOpacity,
      locked: false,
      width: embedLink.intrinsicSize.w,
      height: embedLink.intrinsicSize.h,
      link,
    });

    this.scene.insertElement(element);

    return element;
  };

  private newImagePlaceholder = (opts: {
    sceneX: number;
    sceneY: number;
    addToFrameUnderCursor?: boolean;
  }) => imageEraseOps.newImagePlaceholder(this.engineContext, opts);

  private handleLinearElementOnPointerDown = (
    event: React.PointerEvent<HTMLElement>,
    elementType: ExcalidrawLinearElement["type"],
    pointerDownState: PointerDownState,
  ): void =>
    pointerDownSubOps.handleLinearElementOnPointerDown(
      this.engineContext,
      event,
      elementType,
      pointerDownState,
    );

  private getCurrentItemRoundness(
    elementType:
      | "selection"
      | "rectangle"
      | "diamond"
      | "ellipse"
      | "iframe"
      | "embeddable",
  ) {
    return this.state.currentItemRoundness === "round"
      ? {
          type: isUsingAdaptiveRadius(elementType)
            ? ROUNDNESS.ADAPTIVE_RADIUS
            : ROUNDNESS.PROPORTIONAL_RADIUS,
        }
      : null;
  }

  private createGenericElementOnPointerDown = (
    elementType: ExcalidrawGenericElement["type"] | "embeddable",
    pointerDownState: PointerDownState,
  ): void =>
    pointerDownSubOps.createGenericElementOnPointerDown(
      this.engineContext,
      elementType,
      pointerDownState,
    );

  private createFrameElementOnPointerDown = (
    pointerDownState: PointerDownState,
    type: Extract<ToolType, "frame" | "magicframe">,
  ): void =>
    pointerDownSubOps.createFrameElementOnPointerDown(
      this.engineContext,
      pointerDownState,
      type,
    );

  private maybeCacheReferenceSnapPoints(
    event: KeyboardModifiersObject,
    selectedElements: ExcalidrawElement[],
    recomputeAnyways: boolean = false,
  ) {
    pointerHelperOps.maybeCacheReferenceSnapPoints(
      this.engineContext,
      event,
      selectedElements,
      recomputeAnyways,
    );
  }

  private maybeCacheVisibleGaps(
    event: KeyboardModifiersObject,
    selectedElements: ExcalidrawElement[],
    recomputeAnyways: boolean = false,
  ) {
    pointerHelperOps.maybeCacheVisibleGaps(
      this.engineContext,
      event,
      selectedElements,
      recomputeAnyways,
    );
  }

  private onKeyDownFromPointerDownHandler(
    pointerDownState: PointerDownState,
  ): (event: KeyboardEvent) => void {
    return withBatchedUpdates((event: KeyboardEvent) => {
      if (this.maybeHandleResize(pointerDownState, event)) {
        return;
      }
      this.maybeDragNewGenericElement(pointerDownState, event);
    });
  }

  private onKeyUpFromPointerDownHandler(
    pointerDownState: PointerDownState,
  ): (event: KeyboardEvent) => void {
    return withBatchedUpdates((event: KeyboardEvent) => {
      // Prevents focus from escaping excalidraw tab
      event.key === KEYS.ALT && event.preventDefault();
      if (this.maybeHandleResize(pointerDownState, event)) {
        return;
      }
      this.maybeDragNewGenericElement(pointerDownState, event);
    });
  }

  private onPointerMoveFromPointerDownHandler(
    pointerDownState: PointerDownState,
  ) {
    return pointerMoveOps.onPointerMoveFromPointerDownHandler(
      this.engineContext,
      pointerDownState,
    );
  }

  // Returns whether the pointer move happened over either scrollbar
  private handlePointerMoveOverScrollbars(
    event: PointerEvent,
    pointerDownState: PointerDownState,
  ): boolean {
    return pointerHelperOps.handlePointerMoveOverScrollbars(
      this.engineContext,
      event,
      pointerDownState,
    );
  }

  private onPointerUpFromPointerDownHandler(
    pointerDownState: PointerDownState,
  ): (event: PointerEvent) => void {
    return pointerUpOps.onPointerUpFromPointerDownHandler(
      this.engineContext,
      pointerDownState,
    );
  }

  private restoreReadyToEraseElements = () =>
    imageEraseOps.restoreReadyToEraseElements(this.engineContext);

  private eraseElements = () =>
    imageEraseOps.eraseElements(this.engineContext);

  private initializeImage = async (
    placeholderImageElement: ExcalidrawImageElement,
    imageFile: File,
  ) => {
    // at this point this should be guaranteed image file, but we do this check
    // to satisfy TS down the line
    if (!isSupportedImageFile(imageFile)) {
      throw new Error(t("errors.unsupportedFileType"));
    }
    const mimeType = imageFile.type;

    setCursor(this.interactiveCanvas, "wait");

    if (mimeType === MIME_TYPES.svg) {
      try {
        imageFile = SVGStringToFile(
          normalizeSVG(await imageFile.text()),
          imageFile.name,
        );
      } catch (error: any) {
        console.warn(error);
        throw new Error(t("errors.svgImageInsertError"));
      }
    }

    // generate image id (by default the file digest) before any
    // resizing/compression takes place to keep it more portable
    const fileId = await ((this.props.generateIdForFile?.(
      imageFile,
    ) as Promise<FileId>) || generateIdFromFile(imageFile));

    if (!fileId) {
      console.warn(
        "Couldn't generate file id or the supplied `generateIdForFile` didn't resolve to one.",
      );
      throw new Error(t("errors.imageInsertError"));
    }

    const existingFileData = this.files[fileId];
    if (!existingFileData?.dataURL) {
      try {
        imageFile = await resizeImageFile(imageFile, {
          maxWidthOrHeight: DEFAULT_MAX_IMAGE_WIDTH_OR_HEIGHT,
        });
      } catch (error: any) {
        console.error(
          "Error trying to resizing image file on insertion",
          error,
        );
      }

      if (imageFile.size > MAX_ALLOWED_FILE_BYTES) {
        throw new Error(
          t("errors.fileTooBig", {
            maxSize: `${Math.trunc(MAX_ALLOWED_FILE_BYTES / 1024 / 1024)}MB`,
          }),
        );
      }
    }

    const dataURL =
      this.files[fileId]?.dataURL || (await getDataURL(imageFile));

    return new Promise<NonDeleted<InitializedExcalidrawImageElement>>(
      async (resolve, reject) => {
        try {
          let initializedImageElement = this.getLatestInitializedImageElement(
            placeholderImageElement,
            fileId,
          );

          this.addMissingFiles([
            {
              mimeType,
              id: fileId,
              dataURL,
              created: Date.now(),
              lastRetrieved: Date.now(),
            },
          ]);

          if (!this.imageCache.get(fileId)) {
            this.addNewImagesToImageCache();

            const { erroredFiles } = await this.updateImageCache([
              initializedImageElement,
            ]);

            if (erroredFiles.size) {
              throw new Error("Image cache update resulted with an error.");
            }
          }

          const imageHTML = await this.imageCache.get(fileId)?.image;

          if (
            imageHTML &&
            this.state.newElement?.id !== initializedImageElement.id
          ) {
            initializedImageElement = this.getLatestInitializedImageElement(
              placeholderImageElement,
              fileId,
            );

            const naturalDimensions = this.getImageNaturalDimensions(
              initializedImageElement,
              imageHTML,
            );

            // no need to create a new instance anymore, just assign the natural dimensions
            Object.assign(initializedImageElement, naturalDimensions);
          }

          resolve(initializedImageElement);
        } catch (error: any) {
          console.error(error);
          reject(new Error(t("errors.imageInsertError")));
        }
      },
    );
  };

  /**
   * use during async image initialization,
   * when the placeholder image could have been modified in the meantime,
   * and when you don't want to loose those modifications
   */
  private getLatestInitializedImageElement = (
    imagePlaceholder: ExcalidrawImageElement,
    fileId: FileId,
  ) =>
    imageEraseOps.getLatestInitializedImageElement(
      this.engineContext,
      imagePlaceholder,
      fileId,
    );

  private onImageToolbarButtonClick = async () => {
    try {
      const clientX = this.state.width / 2 + this.state.offsetLeft;
      const clientY = this.state.height / 2 + this.state.offsetTop;

      const { x, y } = viewportCoordsToSceneCoords(
        { clientX, clientY },
        this.state,
      );

      const imageFiles = await fileOpen({
        description: "Image",
        extensions: Object.keys(
          IMAGE_MIME_TYPES,
        ) as (keyof typeof IMAGE_MIME_TYPES)[],
        multiple: true,
      });

      this.insertImages(imageFiles, x, y);
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error(error);
      } else {
        console.warn(error);
      }
      this.setState(
        {
          newElement: null,
          activeTool: updateActiveTool(this.state, {
            type: this.state.preferredSelectionTool.type,
          }),
        },
        () => {
          this.actionManager.executeAction(actionFinalize);
        },
      );
    }
  };

  private getImageNaturalDimensions = (
    imageElement: ExcalidrawImageElement,
    imageHTML: HTMLImageElement,
  ) =>
    imageEraseOps.getImageNaturalDimensions(
      this.engineContext,
      imageElement,
      imageHTML,
    );

  /** updates image cache, refreshing updated elements and/or setting status
      to error for images that fail during <img> element creation */
  private updateImageCache = async (
    elements: readonly InitializedExcalidrawImageElement[],
    files = this.files,
  ) => {
    const { updatedFiles, erroredFiles } = await _updateImageCache({
      imageCache: this.imageCache,
      fileIds: elements.map((element) => element.fileId),
      files,
    });

    if (erroredFiles.size) {
      this.store.scheduleAction(CaptureUpdateAction.NEVER);
      this.scene.replaceAllElements(
        this.scene.getElementsIncludingDeleted().map((element) => {
          if (
            isInitializedImageElement(element) &&
            erroredFiles.has(element.fileId)
          ) {
            return newElementWith(element, {
              status: "error",
            });
          }
          return element;
        }),
      );
    }

    return { updatedFiles, erroredFiles };
  };

  /** adds new images to imageCache and re-renders if needed */
  private addNewImagesToImageCache = async (
    imageElements: InitializedExcalidrawImageElement[] = getInitializedImageElements(
      this.scene.getNonDeletedElements(),
    ),
    files: BinaryFiles = this.files,
  ) => {
    const uncachedImageElements = imageElements.filter(
      (element) => !element.isDeleted && !this.imageCache.has(element.fileId),
    );

    if (uncachedImageElements.length) {
      const { updatedFiles } = await this.updateImageCache(
        uncachedImageElements,
        files,
      );

      if (updatedFiles.size) {
        for (const element of uncachedImageElements) {
          if (updatedFiles.has(element.fileId)) {
            ShapeCache.delete(element);
          }
        }
      }

      if (updatedFiles.size) {
        this.scene.triggerUpdate();
      }
    }
  };

  /** generally you should use `addNewImagesToImageCache()` directly if you need
   *  to render new images. This is just a failsafe  */
  private scheduleImageRefresh = throttle(() => {
    this.addNewImagesToImageCache();
  }, IMAGE_RENDER_TIMEOUT);

  private clearSelection(hitElement: ExcalidrawElement | null): void {
    this.setState((prevState) => ({
      selectedElementIds: makeNextSelectedElementIds({}, prevState),
      activeEmbeddable: null,
      selectedGroupIds: {},
      // Continue editing the same group if the user selected a different
      // element from it
      editingGroupId:
        prevState.editingGroupId &&
        hitElement != null &&
        isElementInGroup(hitElement, prevState.editingGroupId)
          ? prevState.editingGroupId
          : null,
    }));
    this.setState({
      selectedElementIds: makeNextSelectedElementIds({}, this.state),
      activeEmbeddable: null,
      previousSelectedElementIds: this.state.selectedElementIds,
      selectedLinearElement: null,
    });
  }

  private handleInteractiveCanvasRef = (canvas: HTMLCanvasElement | null) => {
    // canvas is null when unmounting
    if (canvas !== null) {
      this.interactiveCanvas = canvas;

      // -----------------------------------------------------------------------
      // NOTE wheel, touchstart, touchend events must be registered outside
      // of react because react binds them them passively (so we can't prevent
      // default on them)
      this.interactiveCanvas.addEventListener(
        EVENT.TOUCH_START,
        this.onTouchStart,
        { passive: false },
      );
      this.interactiveCanvas.addEventListener(EVENT.TOUCH_END, this.onTouchEnd);
      // -----------------------------------------------------------------------
    } else {
      this.interactiveCanvas?.removeEventListener(
        EVENT.TOUCH_START,
        this.onTouchStart,
      );
      this.interactiveCanvas?.removeEventListener(
        EVENT.TOUCH_END,
        this.onTouchEnd,
      );
    }
  };

  private insertImages = async (
    imageFiles: File[],
    sceneX: number,
    sceneY: number,
  ) => {
    const gridPadding = 50 / this.state.zoom.value;
    // Create, position, and insert placeholders
    const placeholders = positionElementsOnGrid(
      imageFiles.map(() => this.newImagePlaceholder({ sceneX, sceneY })),
      sceneX,
      sceneY,
      gridPadding,
    );
    placeholders.forEach((el) => this.scene.insertElement(el));

    // Create, position, insert and select initialized (replacing placeholders)
    const initialized = await Promise.all(
      placeholders.map(async (placeholder, i) => {
        try {
          return await this.initializeImage(
            placeholder,
            await normalizeFile(imageFiles[i]),
          );
        } catch (error: any) {
          this.setState({
            errorMessage: error.message || t("errors.imageInsertError"),
          });
          return newElementWith(placeholder, { isDeleted: true });
        }
      }),
    );
    const initializedMap = arrayToMap(initialized);

    const positioned = positionElementsOnGrid(
      initialized.filter((el) => !el.isDeleted),
      sceneX,
      sceneY,
      gridPadding,
    );
    const positionedMap = arrayToMap(positioned);

    const nextElements = this.scene
      .getElementsIncludingDeleted()
      .map((el) => positionedMap.get(el.id) ?? initializedMap.get(el.id) ?? el);

    this.updateScene({
      appState: {
        selectedElementIds: makeNextSelectedElementIds(
          Object.fromEntries(positioned.map((el) => [el.id, true])),
          this.state,
        ),
      },
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    this.setState({}, () => {
      // actionFinalize after all state values have been updated
      this.actionManager.executeAction(actionFinalize);
    });
  };

  private handleAppOnDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
      event,
      this.state,
    );
    const dataTransferList = await parseDataTransferEvent(event);

    // must be retrieved first, in the same frame
    const fileItems = dataTransferList.getFiles();

    if (fileItems.length === 1) {
      const { file, fileHandle } = fileItems[0];

      if (
        file &&
        (file.type === MIME_TYPES.png || file.type === MIME_TYPES.svg)
      ) {
        try {
          const scene = await loadFromBlob(
            file,
            this.state,
            this.scene.getElementsIncludingDeleted(),
            fileHandle,
          );
          this.syncActionResult({
            ...scene,
            appState: {
              ...(scene.appState || this.state),
              isLoading: false,
            },
            replaceFiles: true,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });
          return;
        } catch (error: any) {
          if (error.name !== "EncodingError") {
            throw new Error(t("alerts.couldNotLoadInvalidFile"));
          }
          // if EncodingError, fall through to insert as regular image
        }
      }
    }

    const imageFiles = fileItems
      .map((data) => data.file)
      .filter((file) => isSupportedImageFile(file));

    if (imageFiles.length > 0 && this.isToolSupported("image")) {
      return this.insertImages(imageFiles, sceneX, sceneY);
    }
    const excalidrawLibrary_ids = dataTransferList.getData(
      MIME_TYPES.excalidrawlibIds,
    );
    const excalidrawLibrary_data = dataTransferList.getData(
      MIME_TYPES.excalidrawlib,
    );
    if (excalidrawLibrary_ids || excalidrawLibrary_data) {
      try {
        let libraryItems: LibraryItems | null = null;
        if (excalidrawLibrary_ids) {
          const { itemIds } = JSON.parse(
            excalidrawLibrary_ids,
          ) as ExcalidrawLibraryIds;
          const allLibraryItems = await this.library.getLatestLibrary();
          libraryItems = allLibraryItems.filter((item) =>
            itemIds.includes(item.id),
          );
          // legacy library dataTransfer format
        } else if (excalidrawLibrary_data) {
          libraryItems = parseLibraryJSON(excalidrawLibrary_data);
        }
        if (libraryItems?.length) {
          libraryItems = libraryItems.map((item) => ({
            ...item,
            // #6465
            elements: duplicateElements({
              type: "everything",
              elements: item.elements,
              randomizeSeed: true,
            }).duplicatedElements,
          }));

          this.addElementsFromPasteOrLibrary({
            elements: distributeLibraryItemsOnSquareGrid(libraryItems),
            position: event,
            files: null,
          });
        }
      } catch (error: any) {
        this.setState({ errorMessage: error.message });
      }
      return;
    }

    if (fileItems.length > 0) {
      const { file, fileHandle } = fileItems[0];
      if (file) {
        // Attempt to parse an excalidraw/excalidrawlib file
        await this.loadFileToCanvas(file, fileHandle);
      }
    }

    const textItem = dataTransferList.findByType(MIME_TYPES.text);

    if (textItem) {
      const text = textItem.value;
      if (
        text &&
        embeddableURLValidator(text, this.props.validateEmbeddable) &&
        (/^(http|https):\/\/[^\s/$.?#].[^\s]*$/.test(text) ||
          getEmbedLink(text)?.type === "video")
      ) {
        const embeddable = this.insertEmbeddableElement({
          sceneX,
          sceneY,
          link: normalizeLink(text),
        });
        if (embeddable) {
          this.store.scheduleCapture();
          this.setState({ selectedElementIds: { [embeddable.id]: true } });
        }
      }
    }
  };

  loadFileToCanvas = async (
    file: File,
    fileHandle: FileSystemFileHandle | null,
  ) => {
    file = await normalizeFile(file);
    try {
      const elements = this.scene.getElementsIncludingDeleted();
      let ret;
      try {
        ret = await loadSceneOrLibraryFromBlob(
          file,
          this.state,
          elements,
          fileHandle,
        );
      } catch (error: any) {
        const imageSceneDataError = error instanceof ImageSceneDataError;
        if (
          imageSceneDataError &&
          error.code === "IMAGE_NOT_CONTAINS_SCENE_DATA" &&
          !this.isToolSupported("image")
        ) {
          this.setState({
            isLoading: false,
            errorMessage: t("errors.imageToolNotSupported"),
          });
          return;
        }
        const errorMessage = imageSceneDataError
          ? t("alerts.cannotRestoreFromImage")
          : t("alerts.couldNotLoadInvalidFile");
        this.setState({
          isLoading: false,
          errorMessage,
        });
      }
      if (!ret) {
        return;
      }

      if (ret.type === MIME_TYPES.excalidraw) {
        // restore the fractional indices by mutating elements
        syncInvalidIndices(elements.concat(ret.data.elements));

        // don't capture and only update the store snapshot for old elements,
        // otherwise we would end up with duplicated fractional indices on undo
        this.store.scheduleMicroAction({
          action: CaptureUpdateAction.NEVER,
          elements,
          appState: undefined,
        });

        this.setState({ isLoading: true });
        this.syncActionResult({
          ...ret.data,
          appState: {
            ...(ret.data.appState || this.state),
            isLoading: false,
          },
          replaceFiles: true,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      } else if (ret.type === MIME_TYPES.excalidrawlib) {
        await this.library
          .updateLibrary({
            libraryItems: file,
            merge: true,
            openLibraryMenu: true,
          })
          .catch((error) => {
            console.error(error);
            this.setState({ errorMessage: t("errors.importLibraryError") });
          });
      }
    } catch (error: any) {
      this.setState({ isLoading: false, errorMessage: error.message });
    }
  };

  private handleCanvasContextMenu = (
    event: React.MouseEvent<HTMLElement | HTMLCanvasElement>,
  ) => canvasEventOps.handleCanvasContextMenu(this.engineContext, event);

  private maybeDragNewGenericElement = (
    pointerDownState: PointerDownState,
    event: MouseEvent | KeyboardEvent,
    informMutation = true,
  ): void =>
    pointerHelperOps.maybeDragNewGenericElement(
      this.engineContext,
      pointerDownState,
      event,
      informMutation,
    );

  private maybeHandleCrop = (
    pointerDownState: PointerDownState,
    event: MouseEvent | KeyboardEvent,
  ): boolean =>
    pointerHelperOps.maybeHandleCrop(
      this.engineContext,
      pointerDownState,
      event,
    );

  private maybeHandleResize = (
    pointerDownState: PointerDownState,
    event: MouseEvent | KeyboardEvent,
  ): boolean =>
    pointerHelperOps.maybeHandleResize(
      this.engineContext,
      pointerDownState,
      event,
    );

  private getContextMenuItems = (type: "canvas" | "element"): ContextMenuItems =>
    linearHoverContextOps.getContextMenuItems(this.engineContext, type);

  private handleWheel = withBatchedUpdates(
    (event: WheelEvent | React.WheelEvent<HTMLDivElement | HTMLCanvasElement>) =>
      scrollOps.handleWheel(this.engineContext, event),
  );

  private getTextWysiwygSnappedToCenterPosition(
    x: number,
    y: number,
    appState: AppState,
    container?: ExcalidrawTextContainer | null,
  ) {
    return textOps.getTextWysiwygSnappedToCenterPosition(
      this.engineContext,
      x,
      y,
      appState,
      container,
    );
  }

  private savePointer = (x: number, y: number, button: "up" | "down") => {
    if (!x || !y) {
      return;
    }
    const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
      { clientX: x, clientY: y },
      this.state,
    );

    if (isNaN(sceneX) || isNaN(sceneY)) {
      // sometimes the pointer goes off screen
    }

    const pointer: CollaboratorPointer = {
      x: sceneX,
      y: sceneY,
      tool: this.state.activeTool.type === "laser" ? "laser" : "pointer",
    };

    this.props.onPointerUpdate?.({
      pointer,
      button,
      pointersMap: gesture.pointers,
    });
  };

  private resetShouldCacheIgnoreZoomDebounced = debounce(() => {
    if (!this.unmounted) {
      this.setState({ shouldCacheIgnoreZoom: false });
    }
  }, 300);

  private updateDOMRect = (cb?: () => void) => {
    if (this.excalidrawContainerRef?.current) {
      const excalidrawContainer = this.excalidrawContainerRef.current;
      const {
        width,
        height,
        left: offsetLeft,
        top: offsetTop,
      } = excalidrawContainer.getBoundingClientRect();
      const {
        width: currentWidth,
        height: currentHeight,
        offsetTop: currentOffsetTop,
        offsetLeft: currentOffsetLeft,
      } = this.state;

      if (
        width === currentWidth &&
        height === currentHeight &&
        offsetLeft === currentOffsetLeft &&
        offsetTop === currentOffsetTop
      ) {
        if (cb) {
          cb();
        }
        return;
      }

      this.setState(
        {
          width,
          height,
          offsetLeft,
          offsetTop,
        },
        () => {
          cb && cb();
        },
      );
    }
  };

  public refresh = () => {
    this.setState({ ...this.getCanvasOffsets() });
  };

  private getCanvasOffsets(): Pick<AppState, "offsetTop" | "offsetLeft"> {
    if (this.excalidrawContainerRef?.current) {
      const excalidrawContainer = this.excalidrawContainerRef.current;
      const { left, top } = excalidrawContainer.getBoundingClientRect();
      return {
        offsetLeft: left,
        offsetTop: top,
      };
    }
    return {
      offsetLeft: 0,
      offsetTop: 0,
    };
  }

  watchState = () => {};

  private async updateLanguage() {
    const currentLang =
      languages.find((lang) => lang.code === this.props.langCode) ||
      defaultLang;
    await setLanguage(currentLang);
    this.setAppState({});
  }
}

// -----------------------------------------------------------------------------
// TEST HOOKS
// -----------------------------------------------------------------------------
declare global {
  interface Window {
    h: {
      scene: Scene;
      elements: readonly ExcalidrawElement[];
      state: AppState;
      setState: React.Component<any, AppState>["setState"];
      watchState: (prev: any, next: any) => void | undefined;
      app: InstanceType<typeof App>;
      history: History;
      store: Store;
    };
  }
}

export const createTestHook = () => {
  if (isTestEnv() || isDevEnv()) {
    window.h = window.h || ({} as Window["h"]);

    Object.defineProperties(window.h, {
      elements: {
        configurable: true,
        get() {
          return this.app?.scene.getElementsIncludingDeleted();
        },
        set(elements: ExcalidrawElement[]) {
          return this.app?.scene.replaceAllElements(
            syncInvalidIndices(elements),
          );
        },
      },
      scene: {
        configurable: true,
        get() {
          return this.app?.scene;
        },
      },
    });
  }
};

createTestHook();
export default App;
