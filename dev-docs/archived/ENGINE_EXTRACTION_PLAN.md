# Engine Extraction Plan — App.tsx → Framework-Agnostic Modules

> Tổng số method/property: ~150 (bao gồm cả property declarations, arrow-functions, prototype methods)
> Ngày phân tích: 2026-04-21
> App.tsx: 12,838 dòng, class App (618–12791)

---

## Tóm tắt

| Module | Số method | Estimated LOC | Priority |
|--------|-----------|---------------|----------|
| classFields | ~35 | ~200 | P0 – giữ trong class |
| publicAPI | ~20 | ~200 | P0 – giữ trong class |
| lifecycleOps | 8 | ~600 | P1 – componentDidMount/Unmount/Update |
| scrollOps | 10 | ~550 | P1 – ít phụ thuộc nhất |
| gestureOps | 8 | ~290 | P1 – khá độc lập |
| clipboardOps | 7 | ~600 | P1 – tương đối độc lập |
| keyboardEvents | 5 | ~810 | P2 – nhiều phụ thuộc |
| pointerEvents | 21 | ~2600 | P2 – phức tạp nhất |
| selectionOps | 10 | ~650 | P2 |
| bindingOps | 5 | ~540 | P2 |
| linearEditorOps | 2 | ~320 | P2 |
| textOps | 11 | ~650 | P3 |
| imageOps | 13 | ~600 | P3 |
| elementOps | 15 | ~900 | P3 |
| frameOps | 4 | ~45 | P3 |
| cropOps | 3 | ~105 | P3 |
| hyperlinkOps | 5 | ~145 | P4 |
| exportOps | 2 | ~135 | P4 |
| libraryOps | 1 | ~7 | P4 |
| collabBridge | 4 | ~145 | P4 |
| renderHelpers | 4 | ~650 | P4 – extract sau cùng |
| magicOps | 4 | ~195 | P4 – optional |
| uiOps | 12 | ~140 | P4 |

---

## Chi tiết từng module

---

### `classFields` (giữ trong class, không extract)

Property declarations — data holders, refs, emitters.

| Tên | Dòng | Loại | Ghi chú |
|-----|------|------|---------|
| canvas | 619 | AppClassProperties["canvas"] | static canvas element |
| interactiveCanvas | 620 | HTMLCanvasElement \| null | interactive canvas |
| sessionExportThemeOverride | 621 | AppState["theme"] \| undefined | public |
| rc | 622 | RoughCanvas | rough.js canvas |
| unmounted | 623 | boolean | lifecycle flag |
| actionManager | 624 | ActionManager | action registry |
| editorInterface | 625 | EditorInterface | form factor / UI mode |
| stylesPanelMode | 626 | StylesPanelMode | private derived state |
| excalidrawContainerRef | 630 | React.RefObject<HTMLDivElement> | private, DOM ref |
| scene | 632 | Scene | public, core scene |
| fonts | 633 | Fonts | public |
| renderer | 634 | Renderer | public |
| visibleElements | 635 | readonly NonDeletedExcalidrawElement[] | public |
| resizeObserver | 636 | ResizeObserver \| undefined | private |
| library | 637 | Library | public |
| libraryItemsFromStorage | 638 | LibraryItems \| undefined | public |
| id | 639 | string | public editor ID |
| store | 640 | Store | private |
| history | 641 | History | private |
| excalidrawContainerValue | 642 | {container, id} | public context value |
| files | 647 | BinaryFiles | public |
| imageCache | 648 | Map | public image cache |
| iFrameRefs | 649 | Map<id, HTMLIFrameElement> | private |
| embedsValidationStatus | 656 | EmbedsValidationStatus | private |
| initializedEmbeds | 659 | Set | private |
| elementsPendingErasure | 661 | ElementsPendingErasure | private |
| _initialized | 663 | boolean | private |
| editorLifecycleEvents | 665 | AppEventBus | private readonly |
| onEvent | 670 | OnStateChange | public |
| appStateObserver | 677 | AppStateObserver | private |
| onStateChange | 679 | OnStateChange | public |
| flowChartCreator | 681 | FlowChartCreator | public |
| flowChartNavigator | 682 | FlowChartNavigator | private |
| bindModeHandler | 684 | ReturnType<typeof setTimeout> \| null | |
| hitLinkElement | 686 | NonDeletedExcalidrawElement \| undefined | |
| lastPointerDownEvent | 687 | React.PointerEvent \| null | |
| lastPointerUpEvent | 688 | React.PointerEvent \| PointerEvent \| null | |
| lastPointerUpIsDoubleClick | 694 | boolean | |
| lastPointerMoveEvent | 695 | PointerEvent \| null | |
| lastPointerMoveCoords | 697 | {x, y} \| null | private |
| lastCompletedCanvasClicks | 698 | {x, y}[] | private |
| previousPointerMoveCoords | 700 | {x, y} \| null | |
| lastViewportPosition | 701 | {x, y} | |
| animationFrameHandler | 703 | AnimationFrameHandler | |
| laserTrails | 705 | LaserTrails | |
| eraserTrail | 706 | EraserTrail | |
| lassoTrail | 707 | LassoTrail | |
| onChangeEmitter | 709 | Emitter | |
| onPointerDownEmitter | 717 | Emitter | |
| onPointerUpEmitter | 725 | Emitter | |
| onUserFollowEmitter | 732 | Emitter | |
| onScrollChangeEmitter | 733 | Emitter | |
| missingPointerEventCleanupEmitter | 737 | Emitter | |
| onRemoveEventListenersEmitter | 740 | Emitter | |
| api | 742 | ExcalidrawImperativeAPI | |
| previousHoveredBindableElement | 1031 | NonDeletedExcalidrawElement \| null | private |
| frameNameBoundsCache | 1842 | FrameNameBoundsCache | complex object |
| magicGenerations | 2465 | Map<id, MagicGenerationData> | private |
| plugins | 2502 | {diagramToCode?} | public |
| cancelInProgressAnimation | 4300 | (() => void) \| null | private |

---

### `publicAPI` (giữ trong class, expose ra ngoài qua ExcalidrawImperativeAPI)

| Tên | Dòng | Kiểu | Ghi chú |
|-----|------|------|---------|
| createExcalidrawAPI | 744 | () => ExcalidrawImperativeAPI | private, builds the API object |
| getSceneElementsIncludingDeleted | 2412 | () => ExcalidrawElement[] | public |
| getSceneElementsMapIncludingDeleted | 2416 | () => Map | public |
| getSceneElements | 2420 | () => NonDeletedExcalidrawElement[] | public |
| onInsertElements | 2424 | (elements) => void | public |
| onExportImage | 2432 | async (type, elements, opts) => void | public |
| onMagicframeToolSelect | 2618 | () => void | public |
| syncActionResult | 2737 | (actionResult) => void | public (called by ActionManager) |
| dismissLinearEditor | 2724 | () => void | public |
| focusContainer | 2408 | () => void | public |
| refreshEditorInterface | 2991 | () => void | public |
| applyDeltas | 4584 | (deltas, options?) => [...] | public |
| mutateElement | 4605 | (element, updates, informMutation?) | public |
| toggleSidebar | 4630 | ({name, tab, force}) => boolean | public |
| getEditorUIOffsets | 4669 | () => Offsets | public |
| getName | 5595 | () => string | public |
| insertIframeElement | 8873 | ({sceneX, sceneY, width, height}) | public |
| insertEmbeddableElement | 8915 | ({sceneX, sceneY, link}) | public |
| refresh | 12763 | () => void | public |
| updateScene | 4534 | (sceneData) => void | public (withBatchedUpdates) |
| addFiles | 4484 | (files) => void | public |
| setPlugins | 2508 | (plugins) => void | public |

---

### `engine/lifecycleOps.ts`

Lifecycle methods gắn với React class component — không extract thành engine độc lập, nhưng tách thành nhóm riêng.

**Dependencies:**
- `this.state` / `this.setState`
- `this.scene`, `this.store`, `this.history`, `this.library`
- `this.renderer`, `this.fonts`, `this.imageCache`
- `this.api`, `this.editorLifecycleEvents`
- `this.excalidrawContainerRef`, `this.resizeObserver`
- `this.laserTrails`, `this.eraserTrail`, `this.onChangeEmitter`

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| constructor | 788 | public | ~65 | React lifecycle |
| componentDidMount | 3059 | public async | ~92 | React lifecycle |
| componentWillUnmount | 3152 | public | ~52 | React lifecycle |
| componentDidUpdate | 3360 | (implicit) | ~162 | React lifecycle |
| addEventListeners | 3231 | private | ~128 | đăng ký all event listeners |
| removeEventListeners | 3227 | private | ~3 | trigger emitter |
| initializeScene | 2862 | private async | ~121 | init app state từ props |
| onResize | 3205 | private | ~8 | window resize handler |

---

### `engine/scrollOps.ts`

Scroll, zoom, viewport operations.

**Dependencies (external — `this.xxx` fields):**
- `this.state`, `this.setState`
- `this.cancelInProgressAnimation`
- `this.interactiveCanvas`
- `this.scene`

**Dependencies nội bộ (gọi method khác trong class):**
- `scrollToContent` → gọi `this.translateCanvas`, `this.cancelInProgressAnimation`, `this.setState`
- `translateCanvas` → gọi `this.setState`, clears `this.cancelInProgressAnimation`
- `handleCanvasPanUsingWheelOrSpaceDrag` → gọi `this.translateCanvas`, `this.savePointer` (collabBridge), `this.setState`
- `handleWheel` → gọi `this.translateCanvas`, `this.resetShouldCacheIgnoreZoomDebounced`, `this.setState`
- `handlePointerMoveOverScrollbars` → gọi `this.translateCanvas`, `this.setState`
- `onScroll` → gọi `this.setState`

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| zoomCanvas | 4281 | (public) | ~18 | zooms at canvas center |
| scrollToContent | 4302 | (public) | ~141 | scroll/fit to element(s) or URL |
| translateCanvas | 4451 | private | ~6 | wraps setState + cancel animation |
| onScroll | 3543 | private | ~10 | debounced scroll from container |
| updateDOMRect | 12721 | private | ~42 | update offsetLeft/Top state |
| getCanvasOffsets | 12767 | private | ~14 | returns {offsetTop, offsetLeft} |
| handleCanvasPanUsingWheelOrSpaceDrag | 8045 | public | ~242 | pan canvas |
| handleWheel | 12577 | private | ~76 | wheel zoom/scroll handler |
| handlePointerMoveOverScrollbars | 10352 | private | ~32 | scrollbars drag handler |
| resetShouldCacheIgnoreZoomDebounced | 12715 | private | ~5 | debounced zoom cache reset |

---

### `engine/gestureOps.ts`

Touch/gesture/pinch-zoom + laser pointer.

**Dependencies (external — `this.xxx` fields):**
- `this.state`, `this.setState`
- `this.lastViewportPosition`
- `this.laserTrails`, `this.lassoTrail`, `this.eraserTrail`
- `this.interactiveCanvas`

**Dependencies nội bộ (gọi method khác trong class):**
- `onGestureChange` → gọi `this.translateCanvas` (scrollOps), `this.setState`
- `onTouchStart` → gọi `this.setState`, `this.isDoubleClick` (pointerEvents), `this.startTextEditing` (textOps)
- `handleTouchMove` → gọi `this.translateCanvas` (scrollOps), `this.setState`, `this.isTouchScreenMultiTouchGesture`
- `onGestureStart`, `onGestureEnd` → direct `this.setState` only

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| onGestureStart | 5603 | private | ~14 | Safari GestureEvent |
| onGestureChange | 5619 | private | ~30 | Safari pinch zoom |
| onGestureEnd | 5651 | private | ~14 | Safari GestureEvent end |
| onTouchStart | 3584 | private | ~60 | touch double-tap |
| onTouchEnd | 3645 | private | ~14 | touch end |
| isTouchScreenMultiTouchGesture | 5588 | private | ~5 | detect touchscreen multi-point |
| togglePenMode | 4265 | (public) | ~8 | pen mode toggle |
| handleTouchMove | 7341 | private | ~140 | touch move on canvas |

---

### `engine/clipboardOps.ts`

Cut / copy / paste operations.

**Dependencies (external — `this.xxx` fields):**
- `this.state`, `this.setState`
- `this.scene`, `this.store`, `this.actionManager`
- `this.lastViewportPosition`
- `this.props` (onPaste callback)
- `this.editorInterface`

**Dependencies nội bộ (gọi method khác trong class):**
- `pasteFromClipboard` → gọi `this.insertClipboardContent`
- `insertClipboardContent` → gọi `this.addElementsFromPasteOrLibrary`, `this.insertImages` (imageOps), `this.insertEmbeddableElement` (publicAPI), `this.addElementsFromMixedContentPaste`, `this.addTextFromPaste`
- `addElementsFromMixedContentPaste` → gọi `this.addElementsFromPasteOrLibrary`, `this.insertImages` (imageOps), `this.addTextFromPaste`
- `addTextFromPaste` → gọi `this.startTextEditing` (textOps), `this.setState`
- `addElementsFromPasteOrLibrary` → gọi `this.getEffectiveGridSize`, `this.getTopLayerFrameAtSceneCoords` (frameOps), `this.setState`, `this.scene.replaceAllElements`

> **Canonical resolution — removed duplicates:**
> - `addTextFromPaste` (4084): canonical owner is **clipboardOps** (directly triggered from paste pipeline in `insertClipboardContent`). Cross-reference: do NOT place in textOps (it doesn't belong there even though it creates text elements).

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| onCut | 3555 | private | ~12 | cut clipboard handler |
| onCopy | 3567 | private | ~12 | copy clipboard handler |
| pasteFromClipboard | 3827 | public | ~53 | paste handler (withBatchedUpdates) |
| insertClipboardContent | 3660 | private async | ~165 | dispatches pasted content type |
| addElementsFromMixedContentPaste | 4033 | private async | ~50 | handles mixed paste (image + text) |
| addTextFromPaste | 4084 | private | ~118 | creates text elements from text (canonical: clipboardOps) |
| addElementsFromPasteOrLibrary | 3880 | (public) | ~150 | paste/library insert at position |

---

### `engine/keyboardEvents.ts`

Keyboard event handlers.

**Dependencies (external — `this.xxx` fields):**
- `this.state`, `this.setState`
- `this.scene`, `this.actionManager`, `this.store`
- `this.flowChartCreator`, `this.flowChartNavigator`
- `this.interactiveCanvas`
- `this.excalidrawContainerRef`
- `this.editorInterface` (for userAgent / formFactor)

**Dependencies nội bộ (gọi method khác trong class):**
- `onKeyDown` → gọi `this.startImageCropping`, `this.finishImageCropping`, `this.scrollToContent`, `this.getEditorUIOffsets`, `this.setActiveTool`, `this.triggerRender`, `this.updateEditorAtom`, `this.dismissLinearEditor`
- `onKeyUp` → gọi `this.setActiveTool`, `this.setCursor`, `this.resetCursor`
- `onKeyDownFromPointerDownHandler` → gọi `this.maybeHandleResize` (elementOps), `this.maybeDragNewGenericElement` (elementOps)
- `onKeyUpFromPointerDownHandler` → gọi `this.maybeHandleResize` (elementOps), `this.maybeDragNewGenericElement` (elementOps)

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| onKeyDown | 4709 | private | ~590 | main keyboard handler |
| onKeyUp | 5298 | private | ~182 | key up handler |
| onKeyDownFromPointerDownHandler | 9454 | private | ~10 | key handler during pointer drag (canonical owner: keyboardEvents — it's a keyboard-event factory, pointerDownState is just context passed in) |
| onKeyUpFromPointerDownHandler | 9465 | private | ~12 | key-up handler during pointer drag (same rationale) |
| toggleOverscrollBehavior | 2059 | private | ~6 | disable browser overscroll on pointer enter/leave (canonical owner: keyboardEvents — declared near onKeyDown/onKeyUp, controls input behaviour) |

---

### `engine/pointerEvents.ts`

Core pointer/mouse event handlers — most complex module.

**Dependencies (external — `this.xxx` fields):**
- `this.state`, `this.setState`, `this.setAppState`
- `this.scene`, `this.store`, `this.actionManager`
- `this.interactiveCanvas`, `this.canvas`
- `this.lastPointerDownEvent`, `this.lastPointerUpEvent`
- `this.lastPointerMoveEvent`, `this.lastPointerMoveCoords`
- `this.lastViewportPosition`, `this.previousPointerMoveCoords`
- `this.laserTrails`, `this.eraserTrail`, `this.lassoTrail`
- `this.flowChartCreator`, `this.flowChartNavigator`
- `this.animationFrameHandler`
- `this.onPointerDownEmitter`, `this.onPointerUpEmitter`
- `this.missingPointerEventCleanupEmitter`
- `this.editorInterface`

**Dependencies nội bộ (gọi method khác trong class):**
- `handleCanvasPointerDown` → gọi `this.maybeCleanupAfterMissingPointerUp`, `this.maybeUnfollowRemoteUser` (collabBridge), `this.updateEditorAtom`, `this.setAppState`, `this.updateGestureOnPointerDown`, `this.updateScene`, `this.maybeOpenContextMenuAfterPointerDownOnTouchDevices`, `this.handleCanvasPanUsingWheelOrSpaceDrag` (scrollOps), `this.savePointer` (collabBridge), `this.initialPointerDownState`, `this.handleTextAutoResizeHandlePointerDown` (textOps), `this.handleDraggingScrollBar`, `this.clearSelectionIfNotUsingSelection` (selectionOps), `this.handleSelectionOnPointerDown` (selectionOps), `this.isASelectedElement` (selectionOps), `this.handleTextOnPointerDown` (textOps), `this.handleLinearElementOnPointerDown` (linearEditorOps), `this.handleFreeDrawElementOnPointerDown` (elementOps), `this.createFrameElementOnPointerDown` (elementOps), `this.createGenericElementOnPointerDown` (elementOps), `this.onPointerMoveFromPointerDownHandler`, `this.onPointerUpFromPointerDownHandler`, `this.onKeyDownFromPointerDownHandler` (keyboardEvents), `this.onKeyUpFromPointerDownHandler` (keyboardEvents)
- `handleCanvasPointerMove` → gọi `this.savePointer` (collabBridge), `this.translateCanvas` (scrollOps), `this.resetShouldCacheIgnoreZoomDebounced` (scrollOps), `this.getEffectiveGridSize`, `this.getTopLayerFrameAtSceneCoords` (frameOps), `this.handleDelayedBindModeChange` (bindingOps), `this.getElementAtPosition`, `this.getElementsAtPosition`, `this.hitElement` (selectionOps), `this.updateEmbedValidationStatus` (hyperlinkOps), `this.getElementLinkAtPosition` (hyperlinkOps)
- `onPointerMoveFromPointerDownHandler` → gọi `this.getEffectiveGridSize`, `this.handlePointerMoveOverScrollbars` (scrollOps), `this.handleEraser`, `this.maybeHandleCrop` (cropOps), `this.maybeHandleResize` (elementOps), `this.handleDelayedBindModeChange` (bindingOps), `this.maybeDragNewGenericElement` (elementOps), `this.maybeCacheReferenceSnapPoints` (bindingOps), `this.maybeCacheVisibleGaps` (bindingOps), `this.getTopLayerFrameAtSceneCoords` (frameOps)
- `onPointerUpFromPointerDownHandler` → gọi `this.removePointer`, `this.savePointer` (collabBridge), `this.getElementAtPosition`, `this.resetDelayedBindMode` (bindingOps), `this.lassoTrail.endPath`, `this.actionManager.executeAction`, `this.getTopLayerFrameAtSceneCoords` (frameOps), `this.onPointerUpEmitter.trigger`
- `handleCanvasDoubleClick` → gọi `this.getElementAtPosition`, `this.startTextEditing` (textOps), `this.dismissLinearEditor` (linearEditorOps), `this.setActiveTool` (elementOps)
- `handleCanvasContextMenu` → gọi `this.getContextMenuItems` (exportOps), `this.getElementAtPosition`, `this.setState`

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| handleCanvasPointerDown | 7480 | private | ~461 | main pointer down handler |
| handleCanvasPointerMove | 6688 | private | ~638 | main pointer move handler |
| handleCanvasPointerUp | 7941 | private | ~62 | pointer up entry point |
| handleCanvasClick | 6555 | private | ~15 | canvas click dispatch |
| handleCanvasDoubleClick | 6350 | private | ~205 | double click handler |
| handleCanvasContextMenu | 12062 | private | ~71 | right-click context menu |
| handleInteractiveCanvasRef | 11768 | private | ~27 | ref callback for canvas setup |
| removePointer | 4210 | (public) | ~7 | removes pointer from gesture map |
| maybeOpenContextMenuAfterPointerDownOnTouchDevices | 8003 | private | ~25 | touch context menu |
| resetContextMenuTimer | 8028 | private | ~11 | resets context menu timer |
| maybeCleanupAfterMissingPointerUp | 8039 | private | ~6 | cleanup stale pointer state |
| onPointerMoveFromPointerDownHandler | 9478 | private | ~700 | pointermove during drag |
| onPointerUpFromPointerDownHandler | 10384 | private | ~540 | pointerup during drag |
| handleEraser | 7326 | private | ~15 | eraser tool move logic |
| isDoubleClick | 1470 | private | ~10 | double-click detection |
| handleIframeLikeElementHover | 1286 | private | ~30 | iframe hover detection |
| isIframeLikeElementCenter | 1485 | private | ~18 | check if pointer at iframe center |
| updateCurrentCursorPosition | 4662 | private | ~6 | track last viewport position |
| shouldHandleBrowserCanvasDoubleClick | 6326 | private | ~23 | double click filter |
| initialPointerDownState | 8177 | private | ~55 | build PointerDownState object |
| updateGestureOnPointerDown | 8160 | private | ~17 | update gesture state on pointer down |
| handleDraggingScrollBar | 8247 | private | ~53 | scrollbar drag initiation |

> **Canonical resolution — removed duplicates:**
> - `toggleOverscrollBehavior` (2059): canonical owner is **keyboardEvents** (see that module). Cross-reference: called on pointer-enter/leave events in `addEventListeners`.
> - `handleElementLinkClick` (6605): canonical owner is **hyperlinkOps** (link domain logic). Cross-reference: called from `handleCanvasClick`/`handleCanvasDoubleClick` in this module.

---

### `engine/selectionOps.ts`

Element selection and multi-select.

**Dependencies (external — `this.xxx` fields):**
- `this.state`, `this.setState`
- `this.scene`
- `this.editorInterface`
- `this.lassoTrail`

**Dependencies nội bộ (gọi method khác trong class):**
- `handleSelectionOnPointerDown` → gọi `this.isASelectedElement`, `this.isHittingCommonBoundingBoxOfSelectedElements`, `this.getElementAtPosition`, `this.getElementsAtPosition`, `this.hitElement`, `this.setActiveTool` (elementOps), `this.actionManager.executeAction`
- `getElementAtPosition` → gọi `this.hitElement`, `this.getElementHitThreshold`, `this.isIframeLikeElementCenter` (pointerEvents)
- `getElementsAtPosition` → gọi `this.hitElement`, `this.getElementHitThreshold`
- `clearSelectionIfNotUsingSelection` → gọi `this.clearSelection`
- `clearSelection` → gọi `this.setState`

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| handleSelectionOnPointerDown | 8301 | private | ~431 | selection logic on pointer down |
| clearSelectionIfNotUsingSelection | 8287 | private | ~14 | clear selection tool check |
| clearSelection | 11746 | private | ~21 | deselect all elements |
| deselectElements | 5795 | private | ~8 | clear all selection state |
| isASelectedElement | 8732 | private | ~4 | check if element is selected |
| isHittingCommonBoundingBoxOfSelectedElements | 8736 | private | ~18 | bounding box hit test |
| hitElement | 6052 | private | ~46 | single element hit test |
| getElementAtPosition | 5932 | private | ~48 | get topmost element at coords |
| getElementsAtPosition | 5992 | private | ~49 | get all elements at coords |
| getElementHitThreshold | 6042 | (public) | ~9 | hit threshold |

---

### `engine/bindingOps.ts`

Linear element binding — deferred bind mode, hover detection, snap-cache helpers.

**Dependencies (external — `this.xxx` fields):**
- `this.state`, `this.setState`
- `this.scene`
- `this.lastPointerMoveCoords`, `this.lastPointerMoveEvent`
- `this.lastPointerDownEvent`
- `this.bindModeHandler`, `this.previousHoveredBindableElement`

**Dependencies nội bộ (gọi method khác trong class):**
- `handleSkipBindMode` → gọi `this.setState` (direct), calls `this.handleDelayedBindModeChange` conditionally
- `resetDelayedBindMode` → gọi `clearTimeout(this.bindModeHandler)`, `this.setState`
- `handleDelayedBindModeChange` → gọi `this.handleSkipBindMode`, `this.resetDelayedBindMode`, `this.setState`
- `maybeCacheReferenceSnapPoints` → gọi `SnapCache.setReferenceSnapPoints` (static, no this-method call)
- `maybeCacheVisibleGaps` → gọi `SnapCache.setVisibleGaps` (static, no this-method call)

> **Canonical resolution — removed duplicates:**
> - `handleSkipBindMode` (927): canonical owner is **bindingOps** (logic is entirely about binding state management — the Alt key is just the trigger, not the domain). Cross-reference: called from `onKeyDown` (keyboardEvents) and `onKeyUp`.
> - `resetDelayedBindMode` (1014): canonical owner is **bindingOps**. Cross-reference: called from `onKeyDown`, `handleCanvasPointerUp`, `onPointerUpFromPointerDownHandler`.
> - `handleDelayedBindModeChange` (1034): canonical owner is **bindingOps**. Cross-reference: called from `handleCanvasPointerMove`, `onPointerMoveFromPointerDownHandler`.

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| handleSkipBindMode | 927 | private | ~86 | Alt key skip binding (canonical: bindingOps) |
| resetDelayedBindMode | 1014 | private | ~16 | reset bind mode timeout (canonical: bindingOps) |
| handleDelayedBindModeChange | 1034 | private | ~206 | deferred inside-binding mode (canonical: bindingOps) |
| maybeCacheReferenceSnapPoints | 9406 | private | ~22 | cache snap reference points |
| maybeCacheVisibleGaps | 9430 | private | ~22 | cache visible gaps for snap |

---

### `engine/linearEditorOps.ts`

Linear element editor handlers.

**Dependencies (external — `this.xxx` fields):**
- `this.state`, `this.setState`
- `this.scene`
- `this.getEffectiveGridSize`
- `this.actionManager`
- `this.editorInterface`

**Dependencies nội bộ (gọi method khác trong class):**
- `handleLinearElementOnPointerDown` → gọi `this.getEffectiveGridSize`, `this.getTopLayerFrameAtSceneCoords` (frameOps), `this.setState`, `this.actionManager.executeAction`
- `dismissLinearEditor` → gọi `this.setState`

> **Canonical resolution — removed duplicates:**
> - `onKeyDownFromPointerDownHandler` (9454) and `onKeyUpFromPointerDownHandler` (9465): canonical owner is **keyboardEvents** (they are keyboard-event factories; `pointerDownState` is just passed-in context). See keyboardEvents module.

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| handleLinearElementOnPointerDown | 9013 | private | ~302 | linear element draw/edit start |
| dismissLinearEditor | 2724 | public | ~12 | deselect linear editor |

---

### `engine/textOps.ts`

Text editing and WYSIWYG.

**Dependencies (external — `this.xxx` fields):**
- `this.state`, `this.setState`
- `this.scene`, `this.store`
- `this.interactiveCanvas`, `this.canvas`
- `this.excalidrawContainerRef`
- `this.editorInterface`
- `this.actionManager`

**Dependencies nội bộ (gọi method khác trong class):**
- `startTextEditing` → gọi `this.getTextCreationGridPoint`, `this.getTopLayerFrameAtSceneCoords` (frameOps), `this.getTextBindableContainerAtPosition`, `this.getEffectiveGridSize`, `this.handleTextWysiwyg`, `this.focusContainer`, `this.setState`
- `handleTextWysiwyg` → gọi `this.setState`, `this.focusContainer`, `this.actionManager.executeAction`, `this.getTextWysiwygSnappedToCenterPosition`
- `handleTextOnPointerDown` → gọi `this.startTextEditing`, `this.getTextElementAtPosition`, `this.getSelectedTextElement`
- `handleTextAutoResizeHandlePointerDown` → gọi `this.isHittingTextAutoResizeHandle`, `this.setState`

> **Canonical resolution — removed duplicates:**
> - `addTextFromPaste` (4084): canonical owner is **clipboardOps** (triggered as part of paste pipeline). Cross-reference: called from `insertClipboardContent` in clipboardOps.

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| handleTextWysiwyg | 5666 | private | ~128 | WYSIWYG text editor setup |
| startTextEditing | 6137 | private | ~172 | insert/edit text at position |
| handleTextOnPointerDown | 8760 | private | ~44 | text tool pointer down |
| getTextBindableContainerAtPosition | 6099 | private | ~37 | find container at position |
| getTextElementAtPosition | 5866 | private | ~12 | find text element at coords |
| getSelectedTextElement | 5804 | private | ~25 | get selected text element |
| getSelectedTextEditingContainerAtPosition | 5829 | private | ~37 | find editable container |
| getTextWysiwygSnappedToCenterPosition | 12654 | private | ~35 | snap text to container center |
| getTextCreationGridPoint | 1260 | private | ~19 | snap text to grid |
| isHittingTextAutoResizeHandle | 5879 | private | ~26 | detect auto-resize handle hit |
| handleTextAutoResizeHandlePointerDown | 5905 | private | ~25 | auto-resize handle pointer down |

---

### `engine/imageOps.ts`

Image insertion, initialization, caching.

**Dependencies (external — `this.xxx` fields):**
- `this.state`, `this.setState`
- `this.scene`, `this.store`
- `this.files`, `this.imageCache`
- `this.interactiveCanvas`
- `this.props.generateIdForFile`, `this.props.onFileOpen`
- `this.actionManager`

**Dependencies nội bộ (gọi method khác trong class):**
- `insertImages` → gọi `this.initializeImage`, `this.addMissingFiles`, `this.newImagePlaceholder`, `this.getEffectiveGridSize`, `this.getTopLayerFrameAtSceneCoords` (frameOps), `this.setState`
- `onImageToolbarButtonClick` → gọi `this.insertImages`, `this.getLatestInitializedImageElement`, `this.setState`
- `handleAppOnDrop` → gọi `this.insertImages`, `this.setState`, `this.loadFileToCanvas`
- `updateImageCache` → gọi `this.addNewImagesToImageCache`, `this.scheduleImageRefresh`
- `addNewImagesToImageCache` → gọi `this.updateImageCache`
- `loadFileToCanvas` → gọi `this.updateScene` (collabBridge), `this.addMissingFiles`

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| initializeImage | 11468 | private async | ~121 | init image from File |
| insertImages | 11796 | private async | ~61 | insert multiple images |
| newImagePlaceholder | 8968 | private | ~44 | create placeholder image element |
| onImageToolbarButtonClick | 11610 | private async | ~38 | toolbar image insert |
| getLatestInitializedImageElement | 11595 | private | ~14 | get latest image ref |
| getImageNaturalDimensions | 11649 | private | ~26 | compute natural dimensions |
| updateImageCache | 11679 | private async | ~30 | update image cache |
| addNewImagesToImageCache | 11710 | private async | ~30 | cache uncached images |
| scheduleImageRefresh | 11742 | private | ~5 | throttled image refresh |
| addMissingFiles | 4495 | private | ~38 | add new BinaryFiles |
| handleAppOnDrop | 11858 | private async | ~124 | file drop handler |
| loadFileToCanvas | 11983 | (public) | ~78 | load .excalidraw file |
| restoreFileFromShare | 4463 | (public) | ~16 | Web Share API |

---

### `engine/elementOps.ts`

Element creation, mutation, general operations.

**Dependencies (external — `this.xxx` fields):**
- `this.state`, `this.setState`
- `this.scene`, `this.store`
- `this.lastPointerDownEvent`
- `this.editorInterface`
- `this.actionManager`

**Dependencies nội bộ (gọi method khác trong class):**
- `createGenericElementOnPointerDown` → gọi `this.getCurrentItemRoundness`, `this.getEffectiveGridSize`, `this.getTopLayerFrameAtSceneCoords` (frameOps), `this.setState`
- `createFrameElementOnPointerDown` → gọi `this.getEffectiveGridSize`, `this.setState`
- `handleFreeDrawElementOnPointerDown` → gọi `this.getEffectiveGridSize`, `this.getTopLayerFrameAtSceneCoords` (frameOps), `this.setState`
- `maybeDragNewGenericElement` → gọi `this.getEffectiveGridSize`, `this.getTopLayerFrameAtSceneCoords` (frameOps), `this.setState`, `this.scene.mutateElement`, `this.maybeHandleResize`
- `maybeHandleResize` (12343) → gọi `this.getEffectiveGridSize`, `this.scene.mutateElement`, `this.setState`
- `eraseElements` → gọi `this.restoreReadyToEraseElements`, `this.actionManager.executeAction`, `this.setState`
- `setActiveTool` → gọi `this.setState`, `this.setCursor` (uiOps), `this.resetCursor` (uiOps)

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| createGenericElementOnPointerDown | 9315 | private | ~57 | create shape on pointer down |
| createFrameElementOnPointerDown | 9373 | private | ~32 | create frame on pointer down |
| handleFreeDrawElementOnPointerDown | 8804 | private | ~68 | freedraw start |
| maybeDragNewGenericElement | 12134 | private | ~116 | drag element being created |
| maybeHandleResize | 12343 | private | ~92 | handle element resize during drag |
| getCurrentItemRoundness | 9297 | private | ~17 | roundness from state |
| eraseElements | 11384 | private | ~83 | delete elements pending erasure |
| restoreReadyToEraseElements | 11379 | private | ~4 | clear erase pending set |
| setActiveTool | 5491 | (public) | ~79 | set active drawing tool |
| toggleLock | 4218 | (public) | ~25 | lock/unlock active tool |
| updateEditorAtom | 855 | (public) | ~7 | update jotai atom |
| setOpenDialog | 5571 | (public) | ~3 | open a dialog |
| setToast | 4459 | (public) | ~3 | show a toast |
| onHandToolToggle | 4274 | (public) | ~3 | toggle hand tool |
| getEffectiveGridSize | 1254 | public | ~5 | grid size or null |

---

### `engine/frameOps.ts`

Frame manipulation.

**Dependencies (external — `this.xxx` fields):**
- `this.state`, `this.setState`
- `this.scene`
- `this.excalidrawContainerRef`
- `this.frameNameBoundsCache`
- `this.canvas`

**Dependencies nội bộ (gọi method khác trong class):**
- `getTopLayerFrameAtSceneCoords` → pure lookup into `this.scene`, no this-method calls
- `resetEditingFrame` → gọi `this.setState`
- `updateFrameRendering` → gọi `this.setState`

> **Canonical resolution — removed duplicates:**
> - `renderFrameNames` (1897): canonical owner is **renderHelpers** (it returns JSX rendered into the React tree). Cross-reference: called from `render()`. Removed from frameOps.

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| resetEditingFrame | 1890 | private | ~6 | clear editingFrame state |
| getFrameNameDOMId | 1838 | private | ~3 | DOM id for frame name |
| getTopLayerFrameAtSceneCoords | 6673 | private | ~15 | get frame under coords |
| updateFrameRendering | 4244 | (public) | ~21 | toggle frame rendering opts |

---

### `engine/cropOps.ts`

Image crop operations.

**Dependencies:**
- `this.state`, `this.setState`
- `this.scene`
- `this.store`
- `this.imageCache`
- `this.getEffectiveGridSize`

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| startImageCropping | 6310 | private | ~6 | enter crop mode |
| finishImageCropping | 6317 | private | ~7 | exit crop mode |
| maybeHandleCrop | 12251 | private | ~92 | crop drag handler |

---

### `engine/hyperlinkOps.ts`

Link popover and embed handling.

**Dependencies (external — `this.xxx` fields):**
- `this.state`, `this.setState`
- `this.scene`
- `this.props.validateEmbeddable`
- `this.iFrameRefs`, `this.embedsValidationStatus`, `this.initializedEmbeds`

**Dependencies nội bộ (gọi method khác trong class):**
- `handleElementLinkClick` → gọi `this.getElementLinkAtPosition`, `this.scrollToContent` (scrollOps), `this.setState`
- `updateEmbeddables` → gọi `this.updateEmbedValidationStatus`, `this.setState`
- `getElementLinkAtPosition` → pure lookup, no this-method calls

> **Canonical resolution:**
> - `handleElementLinkClick` (6605): canonical owner is **hyperlinkOps** (link domain logic — navigating to linked elements is hyperlink concern, not generic pointer concern). Cross-reference: called from `handleCanvasClick`/`handleCanvasDoubleClick` in pointerEvents. Removed from pointerEvents.
> - `getElementLinkAtPosition` (6570): canonical owner is **hyperlinkOps**. Cross-reference: called from `handleCanvasPointerMove` in pointerEvents.

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| getElementLinkAtPosition | 6570 | private | ~35 | find link at position (canonical: hyperlinkOps) |
| handleElementLinkClick | 6605 | private | ~68 | navigate to linked element (canonical: hyperlinkOps) |
| updateEmbedValidationStatus | 1507 | private | ~5 | validate embeddable URL |
| updateEmbeddables | 1515 | private | ~34 | GC and validate embeds |
| cacheEmbeddableRef | 1241 | private | ~6 | cache iframe DOM ref |

---

### `engine/exportOps.ts`

Export-related handlers.

**Dependencies:**
- `this.state`
- `this.files`
- `this.getName()`

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| onExportImage | 2432 | public async | ~33 | export canvas to file |
| getContextMenuItems | 12474 | private | ~101 | build context menu items |

---

### `engine/libraryOps.ts`

Library operations.

**Dependencies:**
- `this.library`, `this.state`
- `this.addElementsFromPasteOrLibrary`

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| onInsertElements | 2424 | public | ~7 | insert elements from library |

---

### `engine/collabBridge.ts`

Collaboration bridge — updateScene, pointer sharing, follow mode.

**Dependencies:**
- `this.state`, `this.setState`
- `this.scene`, `this.store`
- `this.props.onPointerUpdate`
- `this.onUserFollowEmitter`

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| updateScene | 4534 | public | ~50 | update scene + collaborators |
| savePointer | 12689 | private | ~25 | send pointer position to collab |
| maybeUnfollowRemoteUser | 4444 | private | ~5 | unfollow if collaborator left |
| onWindowMessage | 864 | private | ~62 | handle postMessage (Vimeo/YT) |

---

### `engine/magicOps.ts` (optional / thêm)

AI/magic frame generation.

**Dependencies:**
- `this.state`, `this.setState`
- `this.scene`, `this.plugins`
- `this.insertIframeElement`, `this.updateMagicGeneration`
- `this.setActiveTool`

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| onMagicframeToolSelect | 2618 | public | ~61 | magic frame tool selection |
| onMagicFrameGenerate | 2512 | private async | ~95 | call AI generation plugin |
| updateMagicGeneration | 2470 | private | ~30 | update magic generation state |
| onIframeSrcCopy | 2607 | private | ~10 | copy generated HTML |

---

### `renderHelpers` (giữ gần class, extract sau cùng)

**Dependencies (external — `this.xxx` fields):**
- `this.state`
- `this.scene`, `this.renderer`
- `this.excalidrawContainerRef`
- `this.frameNameBoundsCache`
- `this.canvas`, `this.interactiveCanvas`
- `this.iFrameRefs`, `this.embedsValidationStatus`

**Dependencies nội bộ (gọi method khác trong class):**
- `render` → gọi `this.renderEmbeddables`, `this.renderFrameNames`, virtually every state read
- `renderFrameNames` → gọi `this.getFrameNameDOMId` (frameOps), `this.frameNameBoundsCache`, `this.getEditorUIOffsets` (publicAPI)
- `renderEmbeddables` → gọi `this.cacheEmbeddableRef` (hyperlinkOps), `this.updateEmbeddables` (hyperlinkOps)
- `renderInteractiveSceneCallback` → gọi `this.setState`, `this.renderer`

> **Canonical resolution:**
> - `renderFrameNames` (1897): canonical owner is **renderHelpers** (returns JSX fragment, rendered inline from `render()`). Removed from frameOps.

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| render | 2066 | public | ~341 | main React render |
| renderEmbeddables | 1550 | private | ~130 | render iframe embeds to DOM |
| renderFrameNames | 1897 | private | ~162 | render frame name labels (canonical: renderHelpers) |
| renderInteractiveSceneCallback | 3523 | private | ~19 | callback from renderer |

---

### `engine/uiOps.ts` (helpers không fit module khác)

**Methods:**

| Tên method | Dòng | Access | LOC ước tính | Ghi chú |
|-----------|------|--------|-------------|---------|
| setCursor | 5575 | private | ~3 | set canvas cursor |
| resetCursor | 5579 | private | ~3 | reset canvas cursor |
| getFormFactor | 2984 | private | ~5 | form factor from props or auto |
| reconcileStylesPanelMode | 3021 | private | ~18 | derive styles panel mode |
| setDesktopUIMode | 3041 | private | ~7 | set desktop UI mode |
| clearImageShapeCache | 3049 | private | ~9 | clear cached shapes for images |
| openEyeDropper | 2680 | private | ~43 | open eye dropper for color |
| setAppState | 4203 | (public) | ~4 | wrapper around setState |
| refreshEditorInterface | 2991 | public | ~29 | recalculate editor dimensions |
| isToolSupported | 5483 | private | ~7 | check tool enabled in UIOptions |
| watchState | 12782 | (public) | ~1 | stub/debug hook |
| updateLanguage | 12784 | private async | ~7 | update i18n language |

---

## AppEngineContext interface

Tổng hợp các `this.xxx` được reference trong engine modules:

```typescript
interface AppEngineContext {
  // State
  getState: () => AppState;
  setState: (
    patch: Partial<AppState> | ((prev: AppState) => Partial<AppState>),
    callback?: () => void,
  ) => void;

  // Core subsystems
  scene: Scene;
  store: Store;
  history: History;
  library: Library;
  fonts: Fonts;
  renderer: Renderer;
  actionManager: ActionManager;

  // Canvas / DOM
  canvas: HTMLCanvasElement;
  interactiveCanvas: HTMLCanvasElement | null;
  excalidrawContainerRef: React.RefObject<HTMLDivElement>;

  // Files / images
  files: BinaryFiles;
  imageCache: Map<FileId, { image: HTMLImageElement | Promise<HTMLImageElement>; mimeType: BinaryFileData["mimeType"] }>;
  addMissingFiles: (files: BinaryFiles | BinaryFileData[], replace?: boolean) => { addedFiles: BinaryFiles };
  addNewImagesToImageCache: () => Promise<void>;

  // Pointer tracking
  lastPointerDownEvent: React.PointerEvent<HTMLElement> | null;
  lastPointerUpEvent: React.PointerEvent<HTMLElement> | PointerEvent | null;
  lastPointerMoveEvent: PointerEvent | null;
  lastPointerMoveCoords: { x: number; y: number } | null;
  lastViewportPosition: { x: number; y: number };
  previousPointerMoveCoords: { x: number; y: number } | null;
  lastPointerUpIsDoubleClick: boolean;
  lastCompletedCanvasClicks: { x: number; y: number }[];

  // Trails / animation
  laserTrails: LaserTrails;
  eraserTrail: EraserTrail;
  lassoTrail: LassoTrail;
  animationFrameHandler: AnimationFrameHandler;

  // Emitters
  onPointerDownEmitter: Emitter<[...]>;
  onPointerUpEmitter: Emitter<[...]>;
  onScrollChangeEmitter: Emitter<[...]>;
  onUserFollowEmitter: Emitter<[...]>;
  onChangeEmitter: Emitter<[...]>;
  missingPointerEventCleanupEmitter: Emitter<[...]>;

  // Flowchart
  flowChartCreator: FlowChartCreator;
  flowChartNavigator: FlowChartNavigator;

  // Frame
  frameNameBoundsCache: FrameNameBoundsCache;

  // Binding
  bindModeHandler: ReturnType<typeof setTimeout> | null;
  previousHoveredBindableElement: NonDeletedExcalidrawElement | null;

  // Misc
  elementsPendingErasure: ElementsPendingErasure;
  embedsValidationStatus: EmbedsValidationStatus;
  iFrameRefs: Map<ExcalidrawElement["id"], HTMLIFrameElement>;
  initializedEmbeds: Set<ExcalidrawIframeLikeElement["id"]>;
  magicGenerations: Map<ExcalidrawIframeElement["id"], MagicGenerationData>;
  plugins: App["plugins"];
  editorInterface: EditorInterface;
  cancelInProgressAnimation: (() => void) | null;
  id: string;
  api: ExcalidrawImperativeAPI;

  // Helper methods (cần inject vào context)
  getEffectiveGridSize: () => NullableGridSize;
  getTopLayerFrameAtSceneCoords: (sceneCoords: { x: number; y: number }) => ExcalidrawFrameLikeElement | null;
  getElementAtPosition: (x: number, y: number, opts?: any) => NonDeleted<ExcalidrawElement> | null;
  getElementsAtPosition: (x: number, y: number, opts?: any) => NonDeleted<ExcalidrawElement>[];
  getElementHitThreshold: (element: ExcalidrawElement) => number;
  translateCanvas: (state: any) => void;
  triggerRender: (force?: boolean) => void;
  syncActionResult: (result: ActionResult) => void;
  setActiveTool: (tool: any, keepSelection?: boolean) => void;
  focusContainer: () => void;
  scrollToContent: (target?: any, opts?: any) => void;
  savePointer: (x: number, y: number, button: "up" | "down") => void;
  getName: () => string;
  isToolSupported: <T extends ToolType | "custom">(tool: T) => boolean;
  setCursor: (cursor: string) => void;
  resetCursor: () => void;
}
```

---

## Thứ tự extraction (priority)

### Phase 2a (tuần 1–2): Ít phụ thuộc nhất, độc lập

1. **`scrollOps`** — chỉ cần `state`, `scene`, `interactiveCanvas`. Không call nhiều method nội bộ.
2. **`gestureOps`** — touch/pinch. Gọi `translateCanvas`, `setState`, `lassoTrail`. Khá tự đủ.
3. **`clipboardOps`** — tương đối độc lập. Gọi `addElementsFromPasteOrLibrary`, `insertImages`, `addTextFromPaste`.

### Phase 2b (tuần 2–3):

4. **`cropOps`** — nhỏ, chỉ 3 method, gọi `scene.mutateElement` + `store.scheduleCapture`.
5. **`imageOps`** — cần `files`, `imageCache`, `store`, `scene`. Nhiều method async.
6. **`libraryOps`** — rất nhỏ, phụ thuộc `library`.
7. **`exportOps`** — `onExportImage` không phụ thuộc nhiều vào nội bộ.
8. **`hyperlinkOps`** — `getElementLinkAtPosition`, `handleElementLinkClick`.

### Phase 2c (tuần 3–5): Các module event chính

9. **`keyboardEvents`** — `onKeyDown` rất dài (~590 LOC), gọi nhiều method khác.
10. **`textOps`** — `startTextEditing`, `handleTextWysiwyg`. Phụ thuộc `scene`, `store`, `interactiveCanvas`.
11. **`bindingOps`** — `handleDelayedBindModeChange` ~206 LOC, cần `scene`, `state`, `lastPointerMoveCoords`.
12. **`linearEditorOps`** — `handleLinearElementOnPointerDown` ~302 LOC.
13. **`frameOps`** — nhỏ (4 method), chỉ cần `scene` + `frameNameBoundsCache`. `renderFrameNames` đã chuyển sang `renderHelpers`.

### Phase 2d (cuối): Phức tạp nhất

14. **`selectionOps`** — `handleSelectionOnPointerDown` ~431 LOC, nhiều state mutations.
15. **`elementOps`** — `createGenericElementOnPointerDown`, `maybeDragNewGenericElement`.
16. **`pointerEvents`** — phức tạp nhất. `handleCanvasPointerDown` ~461 LOC, `onPointerMoveFromPointerDownHandler` ~700 LOC, `onPointerUpFromPointerDownHandler` ~540 LOC. Gọi gần như mọi module khác.
17. **`collabBridge`** — `updateScene`, `savePointer`. Liên kết với external collab system.
18. **`renderHelpers`** — `render()`, `renderEmbeddables()`. Extract sau cùng vì phụ thuộc toàn bộ state.

---

## Ghi chú quan trọng

### Canonical ownership (đã giải quyết)

Tất cả conflict đã được giải quyết — mỗi method có đúng một canonical module:

| Method | Canonical module | Rationale |
|--------|-----------------|-----------|
| `handleSkipBindMode` (927) | **bindingOps** | Logic là binding state, Alt key chỉ là trigger |
| `resetDelayedBindMode` (1014) | **bindingOps** | Timeout timer thuộc về binding domain |
| `handleDelayedBindModeChange` (1034) | **bindingOps** | Deferred binding state machine |
| `onKeyDownFromPointerDownHandler` (9454) | **keyboardEvents** | Keyboard event factory; pointerDownState là context được pass vào |
| `onKeyUpFromPointerDownHandler` (9465) | **keyboardEvents** | Same rationale |
| `toggleOverscrollBehavior` (2059) | **keyboardEvents** | Khai báo gần onKeyDown/onKeyUp, controls input behaviour |
| `addTextFromPaste` (4084) | **clipboardOps** | Triggered from `insertClipboardContent` in paste pipeline |
| `renderFrameNames` (1897) | **renderHelpers** | Returns JSX rendered inline from `render()` |
| `handleElementLinkClick` (6605) | **hyperlinkOps** | Link-domain navigation logic |
| `getElementLinkAtPosition` (6570) | **hyperlinkOps** | Link-domain lookup |
| `addElementsFromPasteOrLibrary` (3880) | **clipboardOps** | Primary caller is paste pipeline; libraryOps cross-references it |
| `maybeHandleResize` (12343) | **elementOps** | Element mutation, not pointer event semantics |

### Static method

- `App.resetTapTwice` (3579): static, liên quan touch double-tap. Có thể tách thành module-level function trong `gestureOps`.

### withBatchedUpdates / withBatchedUpdatesThrottled

- Nhiều method wrap trong `withBatchedUpdates`. Khi extract, cần giữ cơ chế batch update hoặc port tương đương.

### Jotai atoms

- `updateEditorAtom` (855) và `editorJotaiStore` được dùng ở nhiều nơi. Cần thiết kế cách inject store vào engine context.

### Cần tạo thêm

- **`engine/snapOps.ts`**: `maybeCacheReferenceSnapPoints` (9406), `maybeCacheVisibleGaps` (9430) — hiện classify trong bindingOps nhưng thực ra là snap helpers cho pointerEvents.
- **`engine/magicOps.ts`**: AI generation helpers — khá độc lập với core UI.
