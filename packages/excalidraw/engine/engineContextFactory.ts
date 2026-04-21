// Phase 2h.8: factory extracted from App.tsx engineContext getter.
// Builds the AppEngineContext for a given App instance. Wires ~95 fields that
// bridge App-class properties and module-level state into the shape every
// engine module consumes.
//
// `AppLike` is typed as `any` because the factory touches private fields and
// setter patterns on App that aren't part of `AppClassProperties`.
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  LinearElementEditor,
  maybeHandleArrowPointlikeDrag,
  replaceAllElementsInFrame,
  updateFrameMembershipOfSelectedElements,
} from "@excalidraw/element";

import type { ToolType } from "../types";

import { convertElementTypes } from "../components/ConvertElementTypePopup";
import { findShapeByKey } from "../components/shapes";
import {
  getSnapLinesAtPointer,
  isSnappingEnabled,
  snapDraggedElements,
  snapNewElement,
  snapResizingElements,
} from "../snapping";

import { appGlobals } from "./appGlobals";

import type { AppEngineContext } from "./AppEngineContext";

type AppLike = any;

export function createEngineContext(app: AppLike): AppEngineContext {
  return {
    getState: () => app.state,
    setState: (patch, callback) => app.setState(patch as any, callback),
    scene: app.scene,
    store: app.store,
    actionManager: app.actionManager,
    fonts: app.fonts,
    editorInterface: app.editorInterface,
    canvas: app.canvas,
    interactiveCanvas: app.interactiveCanvas,
    excalidrawContainerRef: app.excalidrawContainerRef,
    cancelInProgressAnimation: app.cancelInProgressAnimation,
    setCancelInProgressAnimation: (fn) => {
      app.cancelInProgressAnimation = fn;
    },
    maybeUnfollowRemoteUser: () => app.maybeUnfollowRemoteUser(),
    getIsPanning: () => appGlobals.isPanning,
    setIsPanning: (value) => {
      appGlobals.isPanning = value;
    },
    getIsHoldingSpace: () => appGlobals.isHoldingSpace,
    getIsDraggingScrollBar: () => appGlobals.isDraggingScrollBar,
    getGesture: () => appGlobals.gesture,
    getCurrentScrollBars: () => appGlobals.currentScrollBars,
    getLastPointerUp: () => appGlobals.lastPointerUp,
    setLastPointerUp: (fn) => {
      appGlobals.lastPointerUp = fn;
    },
    getDidTapTwice: () => appGlobals.didTapTwice,
    setDidTapTwice: (value) => {
      appGlobals.didTapTwice = value;
    },
    getTappedTwiceTimer: () => appGlobals.tappedTwiceTimer,
    setTappedTwiceTimer: (value) => {
      appGlobals.tappedTwiceTimer = value;
    },
    getFirstTapPosition: () => appGlobals.firstTapPosition,
    setFirstTapPosition: (value) => {
      appGlobals.firstTapPosition = value;
    },
    getInvalidateContextMenu: () => appGlobals.invalidateContextMenu,
    setInvalidateContextMenu: (value) => {
      appGlobals.invalidateContextMenu = value;
    },
    getIsPlainPaste: () => appGlobals.IS_PLAIN_PASTE,
    setIsPlainPaste: (value) => {
      appGlobals.IS_PLAIN_PASTE = value;
    },
    getIsPlainPasteTimer: () => appGlobals.IS_PLAIN_PASTE_TIMER,
    setIsPlainPasteTimer: (value) => {
      appGlobals.IS_PLAIN_PASTE_TIMER = value;
    },
    getPlainPasteToastShown: () => appGlobals.PLAIN_PASTE_TOAST_SHOWN,
    setPlainPasteToastShown: (value) => {
      appGlobals.PLAIN_PASTE_TOAST_SHOWN = value;
    },
    setIsHoldingSpace: (value) => {
      appGlobals.isHoldingSpace = value;
    },
    files: app.files,
    lassoTrail: app.lassoTrail,
    lastViewportPosition: app.lastViewportPosition,
    onPaste: app.props?.onPaste,
    onDuplicate: app.props?.onDuplicate,
    validateEmbeddable: app.props?.validateEmbeddable,
    focusContainer: () => app.focusContainer(),
    savePointer: (x, y, button) => app.savePointer(x, y, button),
    resetShouldCacheIgnoreZoomDebounced: () =>
      app.resetShouldCacheIgnoreZoomDebounced(),
    deselectElements: () => app.deselectElements(),
    handleCanvasDoubleClick: (event) => app.handleCanvasDoubleClick(event),
    resetContextMenuTimer: () => app.resetContextMenuTimer(),
    isToolSupported: (tool) => app.isToolSupported(tool),
    insertImages: (imageFiles, sceneX, sceneY) =>
      app.insertImages(imageFiles, sceneX, sceneY),
    insertEmbeddableElement: (opts) => app.insertEmbeddableElement(opts),
    addMissingFiles: (files, replace) => app.addMissingFiles(files, replace),
    addNewImagesToImageCache: () => app.addNewImagesToImageCache(),
    getEffectiveGridSize: () => app.getEffectiveGridSize(),
    getTopLayerFrameAtSceneCoords: (sceneCoords) =>
      app.getTopLayerFrameAtSceneCoords(sceneCoords),
    getEditorUIOffsets: () => app.getEditorUIOffsets(),
    setActiveTool: (tool, keepSelection) =>
      app.setActiveTool(tool, keepSelection),
    setToast: (toast) => app.setToast(toast),
    scrollToContent: (target, opts) => app.scrollToContent(target, opts),
    propViewModeEnabled: app.props?.viewModeEnabled,
    getLastPointerMoveEvent: () => app.lastPointerMoveEvent,
    finishImageCropping: () => app.finishImageCropping(),
    startImageCropping: (element) => app.startImageCropping(element),
    updateEditorAtom: (atom, ...args) => app.updateEditorAtom(atom, ...args),
    flowChartCreator: app.flowChartCreator,
    flowChartNavigator: app.flowChartNavigator,
    triggerRender: (force) => app.triggerRender(force),
    handleSkipBindMode: () => app.handleSkipBindMode(),
    resetDelayedBindMode: () => app.resetDelayedBindMode(),
    openEyeDropper: (opts) => app.openEyeDropper(opts),
    toggleLock: (source) => app.toggleLock(source),
    startTextEditing: (opts) => app.startTextEditing(opts),
    syncActionResult: (result) => app.syncActionResult(result),
    handleDelayedBindModeChange: (element, hoveredElement) =>
      app.handleDelayedBindModeChange(element, hoveredElement),
    convertElementTypes: (opts) => convertElementTypes(app, opts),
    findShapeByKey: (key) => findShapeByKey(key, app) as ToolType | null,
    maybeHandleArrowPointlikeDrag: (event) =>
      maybeHandleArrowPointlikeDrag({ app, event }),
    getLastPointerDownEvent: () => app.lastPointerDownEvent,
    getElementAtPosition: (x, y, opts) => app.getElementAtPosition(x, y, opts),
    getTextBindableContainerAtPosition: (x, y) =>
      app.getTextBindableContainerAtPosition(x, y),
    getLastPointerMoveCoords: () => app.lastPointerMoveCoords,
    setHitLinkElement: (element) => {
      app.hitLinkElement = element;
    },
    clearSelection: (hitElement) => app.clearSelection(hitElement),
    isASelectedElement: (hitElement) => app.isASelectedElement(hitElement),
    setOpenDialog: (dialog) => app.setOpenDialog(dialog),
    getElementsAtPosition: (x, y, opts) =>
      app.getElementsAtPosition(x, y, opts),
    getElementLinkAtPosition: (scenePointer, hitElementMightBeLocked) =>
      app.getElementLinkAtPosition(scenePointer, hitElementMightBeLocked),
    linearElementEditor_handlePointerDown: (event, scenePointer, lee) =>
      LinearElementEditor.handlePointerDown(
        event,
        app,
        app.store,
        scenePointer,
        lee,
        app.scene,
      ),
    handleEraser: (event, scenePointer) =>
      app.handleEraser(event, scenePointer),
    handlePointerMoveOverScrollbars: (event, pointerDownState) =>
      app.handlePointerMoveOverScrollbars(event, pointerDownState),
    imageCache: app.imageCache,
    laserTrails: app.laserTrails,
    maybeCacheReferenceSnapPoints: (event, selectedElements, recompute) =>
      app.maybeCacheReferenceSnapPoints(event, selectedElements, recompute),
    maybeCacheVisibleGaps: (event, selectedElements, recompute) =>
      app.maybeCacheVisibleGaps(event, selectedElements, recompute),
    maybeDragNewGenericElement: (pointerDownState, event, informMutation) =>
      app.maybeDragNewGenericElement(pointerDownState, event, informMutation),
    maybeHandleCrop: (pointerDownState, event) =>
      app.maybeHandleCrop(pointerDownState, event),
    maybeHandleResize: (pointerDownState, event) =>
      app.maybeHandleResize(pointerDownState, event),
    getPreviousPointerMoveCoords: () => app.previousPointerMoveCoords,
    setPreviousPointerMoveCoords: (coords) => {
      app.previousPointerMoveCoords = coords;
    },
    snapDraggedElements: (elements, dragOffset, event) =>
      snapDraggedElements(
        elements,
        dragOffset,
        app,
        event,
        app.scene.getNonDeletedElementsMap(),
      ),
    linearElementEditor_addMidpoint: (lee, pointerCoords, snapToGrid) =>
      LinearElementEditor.addMidpoint(
        lee,
        pointerCoords,
        app,
        snapToGrid,
        app.scene,
      ),
    linearElementEditor_handlePointDragging: (event, x, y, lee) =>
      LinearElementEditor.handlePointDragging(event, app, x, y, lee),
    linearElementEditor_handleBoxSelection: (event) =>
      LinearElementEditor.handleBoxSelection(
        event,
        app.state,
        app.setState.bind(app),
        app.scene.getNonDeletedElementsMap(),
      ),
    eraseElements: () => app.eraseElements(),
    eraserTrail: app.eraserTrail,
    getElementHitThreshold: (element) => app.getElementHitThreshold(element),
    getSelectedTextEditingContainerAtPosition: (hitElement, sceneCoords) =>
      app.getSelectedTextEditingContainerAtPosition(hitElement, sceneCoords),
    handleTextWysiwyg: (element, opts) => app.handleTextWysiwyg(element, opts),
    getLastPointerUpEvent: () => app.lastPointerUpEvent,
    getLastPointerUpIsDoubleClick: () => app.lastPointerUpIsDoubleClick,
    missingPointerEventCleanupEmitter_clear: () =>
      app.missingPointerEventCleanupEmitter.clear(),
    onPointerUpEmitter_trigger: (activeTool, pointerDownState, event) =>
      app.onPointerUpEmitter.trigger(activeTool, pointerDownState, event),
    removePointer: (event) => app.removePointer(event),
    appResetCursor: () => app.resetCursor(),
    restoreReadyToEraseElements: () => app.restoreReadyToEraseElements(),
    updateScene: app.updateScene,
    getElementsPendingErasure: () => app.elementsPendingErasure,
    frameNameBoundsCache: app.frameNameBoundsCache,
    propOnPointerUp: app.props?.onPointerUp,
    updateFrameMembershipOfSelectedElements_facade: (allElements) =>
      updateFrameMembershipOfSelectedElements(allElements, app.state, app),
    replaceAllElementsInFrame_facade: (
      allElements,
      nextElementsInFrame,
      frame,
    ) => replaceAllElementsInFrame(allElements, nextElementsInFrame, frame, app),
    setElementsPendingErasure: (ids) => {
      app.elementsPendingErasure = ids;
    },
    isSnappingEnabled_facade: (event, selectedElements) =>
      isSnappingEnabled({ event, app, selectedElements }),
    snapNewElement_facade: (newElement, event, origin, dragOffset) =>
      snapNewElement(
        newElement,
        app,
        event,
        origin,
        dragOffset,
        app.scene.getNonDeletedElementsMap(),
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
        app,
        event,
        dragOffset,
        transformHandle,
      ),
    setLastPointerMoveEvent: (event) => {
      app.lastPointerMoveEvent = event;
    },
    setLastPointerMoveCoords: (coords) => {
      app.lastPointerMoveCoords = coords;
    },
    getHitLinkElement: () => app.hitLinkElement,
    isHittingTextAutoResizeHandle: (selectedElements, point) =>
      app.isHittingTextAutoResizeHandle(selectedElements, point),
    isHittingCommonBoundingBoxOfSelectedElements: (point, selectedElements) =>
      app.isHittingCommonBoundingBoxOfSelectedElements(
        point,
        selectedElements,
      ),
    handleHoverSelectedLinearElement: (lee, x, y) =>
      app.handleHoverSelectedLinearElement(lee, x, y),
    handleIframeLikeElementHover: (opts) =>
      app.handleIframeLikeElementHover(opts),
    linearElementEditor_handlePointerMove: (event, x, y, lee) =>
      LinearElementEditor.handlePointerMove(event, app, x, y, lee),
    linearElementEditor_handlePointerMoveInEditMode: (event, x, y) =>
      LinearElementEditor.handlePointerMoveInEditMode(event, x, y, app),
    getSnapLinesAtPointer_facade: (elements, pointer, event) =>
      getSnapLinesAtPointer(
        elements,
        app,
        pointer,
        event,
        app.scene.getNonDeletedElementsMap(),
      ),
    handleCanvasPointerDown: (event) => app.handleCanvasPointerDown(event),
    setLastPointerDownEvent: (event) => {
      app.lastPointerDownEvent = event;
    },
    setEditorInterface: (patch) => {
      app.editorInterface = Object.assign({}, app.editorInterface, patch);
    },
    setAppState: (patch) => app.setAppState(patch as any),
    propOnPointerDown: app.props?.onPointerDown,
    onPointerDownEmitter_trigger: (activeTool, pointerDownState, event) =>
      app.onPointerDownEmitter.trigger(activeTool, pointerDownState, event),
    missingPointerEventCleanupEmitter_once: (cb) =>
      app.missingPointerEventCleanupEmitter.once(cb),
    maybeCleanupAfterMissingPointerUp: (event) =>
      app.maybeCleanupAfterMissingPointerUp(event),
    maybeOpenContextMenuAfterPointerDownOnTouchDevices: (event) =>
      app.maybeOpenContextMenuAfterPointerDownOnTouchDevices(event),
    updateGestureOnPointerDown: (event) =>
      app.updateGestureOnPointerDown(event),
    initialPointerDownState: (event) => app.initialPointerDownState(event),
    handleTextAutoResizeHandlePointerDown: (selectedElements, point) =>
      app.handleTextAutoResizeHandlePointerDown(selectedElements, point),
    handleDraggingScrollBar: (event, pointerDownState) =>
      app.handleDraggingScrollBar(event, pointerDownState),
    clearSelectionIfNotUsingSelection: () =>
      app.clearSelectionIfNotUsingSelection(),
    handleCanvasPanUsingWheelOrSpaceDrag: (event) =>
      app.handleCanvasPanUsingWheelOrSpaceDrag(event),
    getLastCompletedCanvasClicks: () => app.lastCompletedCanvasClicks,
    setLastCompletedCanvasClicks: (clicks) => {
      app.lastCompletedCanvasClicks = clicks;
    },
    setLastPointerUpEvent: (event) => {
      app.lastPointerUpEvent = event;
    },
    setLastPointerUpIsDoubleClick: (value) => {
      app.lastPointerUpIsDoubleClick = value;
    },
    isDoubleClick: (prev, curr) => app.isDoubleClick(prev, curr),
    handleIframeLikeCenterClick: () => app.handleIframeLikeCenterClick(),
    getContextMenuItems: (type) => app.getContextMenuItems(type),
    handleElementLinkClick: (event) => app.handleElementLinkClick(event),
    getBindModeHandler: () => app.bindModeHandler,
    setBindModeHandler: (handler) => {
      app.bindModeHandler = handler;
    },
    getPreviousHoveredBindableElement: () =>
      app.previousHoveredBindableElement,
    setPreviousHoveredBindableElement: (element) => {
      app.previousHoveredBindableElement = element;
    },
    getHTMLIFrameElement: (element) => app.getHTMLIFrameElement(element),
    getAppId: () => app.id,
    getApp: () => app,
    setIsDraggingScrollBar: (value) => {
      appGlobals.isDraggingScrollBar = value;
    },
    propOnPointerUpdate: app.props?.onPointerUpdate,
    updateImageCache: (elements, files) =>
      app.updateImageCache(elements as any, files),
    propGenerateIdForFile: app.props?.generateIdForFile,
    getLatestInitializedImageElement: (placeholder, fileId) =>
      app.getLatestInitializedImageElement(placeholder, fileId as any),
    getImageNaturalDimensions: (imageElement, imageHTML) =>
      app.getImageNaturalDimensions(imageElement, imageHTML),
    newImagePlaceholder: (opts) => app.newImagePlaceholder(opts),
    initializeImage: (placeholder, file) =>
      app.initializeImage(placeholder, file),
    loadFileToCanvas: (file, fileHandle) =>
      app.loadFileToCanvas(file, fileHandle),
    addElementsFromPasteOrLibrary: (opts) =>
      app.addElementsFromPasteOrLibrary(opts),
    getLibrary: () => app.library,
    propOnLinkOpen: app.props?.onLinkOpen,
  };
}
