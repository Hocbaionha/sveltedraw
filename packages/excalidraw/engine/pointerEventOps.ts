import { flushSync } from "react-dom";

import {
  CURSOR_TYPE,
  EVENT,
  KEYS,
  LINE_CONFIRM_THRESHOLD,
  POINTER_BUTTON,
  TOOL_TYPE,
  addEventListener,
  getFeatureFlag,
  invariant,
  updateActiveTool,
  updateStable,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import {
  CaptureUpdateAction,
  LinearElementEditor,
  getCommonBounds,
  getCursorForResizingElement,
  getElementsInGroup,
  getElementWithTransformHandleType,
  getFrameChildren,
  getHoveredElementForBinding,
  getSnapOutlineMidPoint,
  getTransformHandleTypeFromCoords,
  isArrowElement,
  isBindingElementType,
  isBindingEnabled,
  isElbowArrow,
  isEmbeddableElement,
  isFrameLikeElement,
  isLinearElement,
  isPathALoop,
  isPointInElement,
  isSimpleArrow,
  isTextElement,
  makeNextSelectedElementIds,
  maxBindingDistance_simple,
  selectGroupsForSelectedElements,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFreeDrawElement,
} from "@excalidraw/element/types";

import {
  pointDistance,
  pointFrom,
} from "@excalidraw/math";
import type { GlobalPoint, LocalPoint } from "@excalidraw/math";

import { actionFinalize } from "../actions";
import { isEraserActive, isHandToolActive } from "../appState";
import {
  hideHyperlinkToolip,
  showHyperlinkTooltip,
} from "../components/hyperlink/Hyperlink";
import {
  resetCursor,
  setCursor,
  setCursorForShape,
} from "../cursor";
import { getCenter, getDistance } from "../gesture";
import { getNormalizedZoom } from "../scene";
import { isOverScrollBars } from "../scene/scrollbars";
import { getStateForZoom } from "../scene/zoom";
import { isActiveToolNonLinearSnappable } from "../snapping";
import { withBatchedUpdates } from "../reactUtils";
import { editorJotaiStore } from "../editor-jotai";
import { convertElementTypePopupAtom } from "../components/ConvertElementTypePopup";
import { searchItemInFocusAtom } from "../components/SearchMenu";
import type { UnsubscribeCallback } from "../types";

import { translateCanvas } from "./scrollOps";
import {
  createFrameElementOnPointerDown,
  createGenericElementOnPointerDown,
  handleFreeDrawElementOnPointerDown,
  handleLinearElementOnPointerDown,
  handleSelectionOnPointerDown,
  handleTextOnPointerDown,
} from "./pointerDownSubOps";
import { onPointerMoveFromPointerDownHandler } from "./pointerMoveOps";
import { onPointerUpFromPointerDownHandler } from "./pointerUpOps";
import { maybeDragNewGenericElement, maybeHandleResize } from "./pointerHelperOps";

import type { AppEngineContext } from "./AppEngineContext";

export function handleCanvasPointerMove(
  ctx: AppEngineContext,
  event: React.PointerEvent<HTMLCanvasElement>,
): void {
  const state = ctx.getState();
  ctx.savePointer(event.clientX, event.clientY, state.cursorButton);
  ctx.setLastPointerMoveEvent(event.nativeEvent);
  const scenePointer = viewportCoordsToSceneCoords(event, state);
  const { x: scenePointerX, y: scenePointerY } = scenePointer;
  ctx.setLastPointerMoveCoords({
    x: scenePointerX,
    y: scenePointerY,
  });

  const gesture = ctx.getGesture();
  if (gesture.pointers.has(event.pointerId)) {
    gesture.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
  }

  const initialScale = gesture.initialScale;
  if (
    gesture.pointers.size === 2 &&
    gesture.lastCenter &&
    initialScale &&
    gesture.initialDistance
  ) {
    const center = getCenter(gesture.pointers);
    const deltaX = center.x - gesture.lastCenter.x;
    const deltaY = center.y - gesture.lastCenter.y;
    gesture.lastCenter = center;

    const distance = getDistance(Array.from(gesture.pointers.values()));
    const scaleFactor =
      ctx.getState().activeTool.type === "freedraw" && ctx.getState().penMode
        ? 1
        : distance / gesture.initialDistance;

    const nextZoom = scaleFactor
      ? getNormalizedZoom(initialScale * scaleFactor)
      : ctx.getState().zoom.value;

    ctx.setState((state) => {
      const zoomState = getStateForZoom(
        {
          viewportX: center.x,
          viewportY: center.y,
          nextZoom,
        },
        state,
      );

      translateCanvas(ctx, {
        zoom: zoomState.zoom,
        // 2x multiplier is just a magic number that makes this work correctly
        // on touchscreen devices
        scrollX: zoomState.scrollX + 2 * (deltaX / nextZoom),
        scrollY: zoomState.scrollY + 2 * (deltaY / nextZoom),
        shouldCacheIgnoreZoom: true,
      });

      return null;
    });
    ctx.resetShouldCacheIgnoreZoomDebounced();
  } else {
    gesture.lastCenter =
      gesture.initialDistance =
      gesture.initialScale =
        null;
  }

  if (
    ctx.getIsHoldingSpace() ||
    ctx.getIsPanning() ||
    ctx.getIsDraggingScrollBar() ||
    isHandToolActive(ctx.getState())
  ) {
    return;
  }

  const isPointerOverScrollBars = isOverScrollBars(
    ctx.getCurrentScrollBars(),
    event.clientX - ctx.getState().offsetLeft,
    event.clientY - ctx.getState().offsetTop,
  );
  const isOverScrollBar = isPointerOverScrollBars.isOverEither;
  if (
    !ctx.getState().newElement &&
    !ctx.getState().selectionElement &&
    !ctx.getState().selectedElementsAreBeingDragged &&
    !ctx.getState().multiElement
  ) {
    if (isOverScrollBar) {
      resetCursor(ctx.interactiveCanvas);
    } else {
      setCursorForShape(ctx.interactiveCanvas, ctx.getState());
    }
  }

  if (
    !ctx.getState().newElement &&
    isActiveToolNonLinearSnappable(ctx.getState().activeTool.type)
  ) {
    const { originOffset, snapLines } = ctx.getSnapLinesAtPointer_facade(
      ctx.scene.getNonDeletedElements(),
      {
        x: scenePointerX,
        y: scenePointerY,
      },
      event,
    );

    ctx.setState((prevState) => {
      const nextSnapLines = updateStable(prevState.snapLines, snapLines);
      const nextOriginOffset = prevState.originSnapOffset
        ? updateStable(prevState.originSnapOffset, originOffset)
        : originOffset;

      if (
        prevState.snapLines === nextSnapLines &&
        prevState.originSnapOffset === nextOriginOffset
      ) {
        return null;
      }
      return {
        snapLines: nextSnapLines,
        originSnapOffset: nextOriginOffset,
      };
    });
  } else if (
    !ctx.getState().newElement &&
    !ctx.getState().selectedElementsAreBeingDragged &&
    !ctx.getState().selectionElement
  ) {
    ctx.setState((prevState) => {
      if (prevState.snapLines.length) {
        return {
          snapLines: [],
        };
      }
      return null;
    });
  }

  if (
    ctx.getState().selectedLinearElement?.isEditing &&
    !ctx.getState().selectedLinearElement!.isDragging
  ) {
    const editingLinearElement = ctx.getState().newElement
      ? null
      : ctx.linearElementEditor_handlePointerMoveInEditMode(
          event,
          scenePointerX,
          scenePointerY,
        );

    if (
      editingLinearElement &&
      editingLinearElement !== ctx.getState().selectedLinearElement
    ) {
      flushSync(() => {
        ctx.setState({
          selectedLinearElement: editingLinearElement,
        });
      });
    }
  }

  if (isBindingElementType(ctx.getState().activeTool.type)) {
    const { newElement } = ctx.getState();
    if (!newElement && isBindingEnabled(ctx.getState())) {
      const globalPoint = pointFrom<GlobalPoint>(
        scenePointerX,
        scenePointerY,
      );
      const elementsMap = ctx.scene.getNonDeletedElementsMap();
      const hoveredElement = getHoveredElementForBinding(
        globalPoint,
        ctx.scene.getNonDeletedElements(),
        elementsMap,
        maxBindingDistance_simple(ctx.getState().zoom),
      );
      if (hoveredElement) {
        ctx.setState({
          suggestedBinding: {
            element: hoveredElement,
            midPoint: getSnapOutlineMidPoint(
              globalPoint,
              hoveredElement,
              elementsMap,
              ctx.getState().zoom,
            ),
          },
        });
      } else if (ctx.getState().suggestedBinding) {
        ctx.setState({
          suggestedBinding: null,
        });
      }
    }
  }

  if (ctx.getState().multiElement && ctx.getState().selectedLinearElement) {
    const { multiElement, selectedLinearElement } = ctx.getState();
    const { x: rx, y: ry, points } = multiElement!;
    const lastPoint = points[points.length - 1];

    const { lastCommittedPoint } = selectedLinearElement!;

    setCursorForShape(ctx.interactiveCanvas, ctx.getState());

    if (lastPoint === lastCommittedPoint) {
      const hoveredElement =
        isArrowElement(ctx.getState().newElement) &&
        isBindingEnabled(ctx.getState()) &&
        getHoveredElementForBinding(
          pointFrom<GlobalPoint>(scenePointerX, scenePointerY),
          ctx.scene.getNonDeletedElements(),
          ctx.scene.getNonDeletedElementsMap(),
          maxBindingDistance_simple(ctx.getState().zoom),
        );
      if (hoveredElement) {
        ctx.actionManager.executeAction(actionFinalize, "ui", {
          event: event.nativeEvent,
          sceneCoords: {
            x: scenePointerX,
            y: scenePointerY,
          },
        });
        ctx.setState({ suggestedBinding: null, startBoundElement: null });
        if (!ctx.getState().activeTool.locked) {
          resetCursor(ctx.interactiveCanvas);
          ctx.setState((prevState) => ({
            newElement: null,
            activeTool: updateActiveTool(ctx.getState(), {
              type: ctx.getState().preferredSelectionTool.type,
            }),
            selectedElementIds: makeNextSelectedElementIds(
              {
                ...prevState.selectedElementIds,
                [multiElement!.id]: true,
              },
              prevState,
            ),
            selectedLinearElement: new LinearElementEditor(
              multiElement!,
              ctx.scene.getNonDeletedElementsMap(),
            ),
          }));
        }
      } else if (
        pointDistance(
          pointFrom(scenePointerX - rx, scenePointerY - ry),
          lastPoint,
        ) >= LINE_CONFIRM_THRESHOLD
      ) {
        ctx.scene.mutateElement(
          multiElement!,
          {
            points: [
              ...points,
              pointFrom<LocalPoint>(scenePointerX - rx, scenePointerY - ry),
            ],
          },
          { informMutation: false, isDragging: false },
        );
        invariant(
          ctx.getState().selectedLinearElement?.initialState,
          "initialState must be set",
        );
        ctx.setState({
          selectedLinearElement: {
            ...ctx.getState().selectedLinearElement!,
            lastCommittedPoint: points[points.length - 1],
            selectedPointsIndices: [multiElement!.points.length - 1],
            initialState: {
              ...ctx.getState().selectedLinearElement!.initialState!,
              lastClickedPoint: multiElement!.points.length - 1,
            },
          },
        });
      } else {
        setCursor(ctx.interactiveCanvas, CURSOR_TYPE.POINTER);
      }
    } else if (
      points.length > 2 &&
      lastCommittedPoint &&
      pointDistance(
        pointFrom(scenePointerX - rx, scenePointerY - ry),
        lastCommittedPoint,
      ) < LINE_CONFIRM_THRESHOLD
    ) {
      setCursor(ctx.interactiveCanvas, CURSOR_TYPE.POINTER);
      ctx.scene.mutateElement(
        multiElement!,
        {
          points: points.slice(0, -1),
        },
        { informMutation: false, isDragging: false },
      );
      const newLastIdx = multiElement!.points.length - 1;
      ctx.setState({
        selectedLinearElement: {
          ...selectedLinearElement!,
          selectedPointsIndices: selectedLinearElement!.selectedPointsIndices
            ? [
                ...new Set(
                  selectedLinearElement!.selectedPointsIndices.map((idx) =>
                    Math.min(idx, newLastIdx),
                  ),
                ),
              ]
            : selectedLinearElement!.selectedPointsIndices,
          lastCommittedPoint: multiElement!.points[newLastIdx],
          initialState: {
            ...selectedLinearElement!.initialState!,
            lastClickedPoint: newLastIdx,
          },
        },
      });
    } else {
      if (isPathALoop(points, ctx.getState().zoom.value)) {
        setCursor(ctx.interactiveCanvas, CURSOR_TYPE.POINTER);
      }

      const elementsMap = ctx.scene.getNonDeletedElementsMap();

      if (isSimpleArrow(multiElement!)) {
        const hoveredElement = getHoveredElementForBinding(
          pointFrom<GlobalPoint>(scenePointerX, scenePointerY),
          ctx.scene.getNonDeletedElements(),
          elementsMap,
        );

        if (getFeatureFlag("COMPLEX_BINDINGS")) {
          ctx.handleDelayedBindModeChange(multiElement as any, hoveredElement);
        }
      }

      invariant(
        ctx.getState().selectedLinearElement,
        "Expected selectedLinearElement to be set to operate on a linear element",
      );

      const newState = ctx.linearElementEditor_handlePointerMove(
        event.nativeEvent,
        scenePointerX,
        scenePointerY,
        ctx.getState().selectedLinearElement!,
      );
      if (newState) {
        ctx.setState(newState);
      }
    }

    return;
  }

  if (ctx.getState().activeTool.type === "arrow") {
    const hit = getHoveredElementForBinding(
      pointFrom<GlobalPoint>(scenePointerX, scenePointerY),
      ctx.scene.getNonDeletedElements(),
      ctx.scene.getNonDeletedElementsMap(),
      maxBindingDistance_simple(ctx.getState().zoom),
    );
    const sceneGlobalPoint = pointFrom<GlobalPoint>(
      scenePointerX,
      scenePointerY,
    );
    const elementsMap = ctx.scene.getNonDeletedElementsMap();
    if (hit && !isPointInElement(sceneGlobalPoint, hit, elementsMap)) {
      ctx.setState({
        suggestedBinding: {
          element: hit,
          midPoint: getSnapOutlineMidPoint(
            sceneGlobalPoint,
            hit,
            elementsMap,
            ctx.getState().zoom,
          ),
        },
      });
    }
  }

  const isPressingAnyButton = Boolean(event.buttons);
  const isLaserTool = ctx.getState().activeTool.type === "laser";
  if (
    isPressingAnyButton ||
    (!isLaserTool &&
      ctx.getState().activeTool.type !== "selection" &&
      ctx.getState().activeTool.type !== "lasso" &&
      ctx.getState().activeTool.type !== "text" &&
      ctx.getState().activeTool.type !== "eraser")
  ) {
    return;
  }

  const elements = ctx.scene.getNonDeletedElements();

  const selectedElements = ctx.scene.getSelectedElements(ctx.getState());

  if (ctx.isHittingTextAutoResizeHandle(selectedElements, scenePointer)) {
    setCursor(ctx.interactiveCanvas, CURSOR_TYPE.POINTER);
    return;
  }

  if (
    selectedElements.length === 1 &&
    !isOverScrollBar &&
    !ctx.getState().selectedLinearElement?.isEditing
  ) {
    if (ctx.getState().selectedLinearElement) {
      ctx.handleHoverSelectedLinearElement(
        ctx.getState().selectedLinearElement!,
        scenePointerX,
        scenePointerY,
      );
    }

    if (
      (!ctx.getState().selectedLinearElement ||
        ctx.getState().selectedLinearElement!.hoverPointIndex === -1) &&
      ctx.getState().openDialog?.name !== "elementLinkSelector" &&
      !(selectedElements.length === 1 && isElbowArrow(selectedElements[0])) &&
      !(
        isLinearElement(selectedElements[0]) &&
        (ctx.editorInterface.userAgent.isMobileDevice ||
          selectedElements[0].points.length === 2)
      )
    ) {
      const elementWithTransformHandleType =
        getElementWithTransformHandleType(
          elements,
          ctx.getState(),
          scenePointerX,
          scenePointerY,
          ctx.getState().zoom,
          event.pointerType,
          ctx.scene.getNonDeletedElementsMap(),
          ctx.editorInterface,
        );
      if (
        elementWithTransformHandleType &&
        elementWithTransformHandleType.transformHandleType
      ) {
        setCursor(
          ctx.interactiveCanvas,
          getCursorForResizingElement(elementWithTransformHandleType),
        );
        return;
      }
    }
  } else if (
    selectedElements.length > 1 &&
    !isOverScrollBar &&
    ctx.getState().openDialog?.name !== "elementLinkSelector"
  ) {
    const transformHandleType = getTransformHandleTypeFromCoords(
      getCommonBounds(selectedElements),
      scenePointerX,
      scenePointerY,
      ctx.getState().zoom,
      event.pointerType,
      ctx.editorInterface,
    );
    if (transformHandleType) {
      setCursor(
        ctx.interactiveCanvas,
        getCursorForResizingElement({
          transformHandleType,
        }),
      );
      return;
    }
  }

  if (isEraserActive(ctx.getState())) {
    return;
  }

  const hitElementMightBeLocked = ctx.getElementAtPosition(
    scenePointerX,
    scenePointerY,
    {
      preferSelected: true,
      includeLockedElements: true,
    },
  );

  let hitElement: ExcalidrawElement | null = null;
  if (hitElementMightBeLocked && hitElementMightBeLocked.locked) {
    hitElement = null;
  } else {
    hitElement = hitElementMightBeLocked;
  }

  if (
    !ctx.handleIframeLikeElementHover({
      hitElement,
      scenePointer,
      moveEvent: event,
    })
  ) {
    ctx.setHitLinkElement(
      ctx.getElementLinkAtPosition(scenePointer, hitElementMightBeLocked) as any,
    );
  }

  const hitLinkElement = ctx.getHitLinkElement();
  if (
    hitLinkElement &&
    !ctx.getState().selectedElementIds[hitLinkElement.id]
  ) {
    setCursor(ctx.interactiveCanvas, CURSOR_TYPE.POINTER);

    showHyperlinkTooltip(
      hitLinkElement,
      ctx.getState(),
      ctx.scene.getNonDeletedElementsMap(),
    );
  } else {
    hideHyperlinkToolip();
    if (isLaserTool) {
      return;
    }
    if (
      hitElement &&
      (hitElement.link || isEmbeddableElement(hitElement)) &&
      ctx.getState().selectedElementIds[hitElement.id] &&
      !ctx.getState().contextMenu &&
      !ctx.getState().showHyperlinkPopup
    ) {
      ctx.setState({ showHyperlinkPopup: "info" });
    } else if (ctx.getState().activeTool.type === "text") {
      setCursor(
        ctx.interactiveCanvas,
        isTextElement(hitElement) ? CURSOR_TYPE.TEXT : CURSOR_TYPE.CROSSHAIR,
      );
    } else if (
      !event[KEYS.CTRL_OR_CMD] &&
      ctx.isHittingCommonBoundingBoxOfSelectedElements(
        scenePointer,
        selectedElements,
      )
    ) {
      setCursor(ctx.interactiveCanvas, CURSOR_TYPE.MOVE);
    } else if (ctx.getState().viewModeEnabled) {
      setCursor(ctx.interactiveCanvas, CURSOR_TYPE.GRAB);
    } else if (ctx.getState().openDialog?.name === "elementLinkSelector") {
      setCursor(ctx.interactiveCanvas, CURSOR_TYPE.AUTO);
    } else if (isOverScrollBar) {
      setCursor(ctx.interactiveCanvas, CURSOR_TYPE.AUTO);
    } else if (
      !event[KEYS.CTRL_OR_CMD] &&
      hitElement?.id !== ctx.getState().editingTextElement?.id
    ) {
      if (
        (hitElement ||
          ctx.isHittingCommonBoundingBoxOfSelectedElements(
            scenePointer,
            selectedElements,
          )) &&
        !hitElement?.locked
      ) {
        if (
          !hitElement ||
          !isElbowArrow(hitElement) ||
          !(hitElement.startBinding || hitElement.endBinding)
        ) {
          if (
            ctx.getState().activeTool.type !== "lasso" ||
            selectedElements.length > 0
          ) {
            setCursor(ctx.interactiveCanvas, CURSOR_TYPE.MOVE);
          }
        }
      }
    } else {
      setCursor(ctx.interactiveCanvas, CURSOR_TYPE.AUTO);
    }

    if (ctx.getState().selectedLinearElement) {
      ctx.handleHoverSelectedLinearElement(
        ctx.getState().selectedLinearElement!,
        scenePointerX,
        scenePointerY,
      );
    }
  }

  if (ctx.getState().openDialog?.name === "elementLinkSelector" && hitElement) {
    ctx.setState((prevState) => {
      return {
        hoveredElementIds: updateStable(
          prevState.hoveredElementIds,
          selectGroupsForSelectedElements(
            {
              editingGroupId: prevState.editingGroupId,
              selectedElementIds: { [hitElement!.id]: true },
            },
            ctx.scene.getNonDeletedElements(),
            prevState,
            null,
          ).selectedElementIds,
        ),
      };
    });
  } else if (
    ctx.getState().openDialog?.name === "elementLinkSelector" &&
    !hitElement
  ) {
    ctx.setState((prevState) => ({
      hoveredElementIds: updateStable(prevState.hoveredElementIds, {}),
    }));
  }
}

export function handleCanvasPointerDown(
  ctx: AppEngineContext,
  event: React.PointerEvent<HTMLElement>,
): void {
  const selectedElements = ctx.scene.getSelectedElements(ctx.getState());

  if (!event.ctrlKey) {
    const preferenceEnabled =
      ctx.getState().bindingPreference === "enabled";
    if (ctx.getState().isBindingEnabled !== preferenceEnabled) {
      ctx.setState({ isBindingEnabled: preferenceEnabled });
    }
  }

  const scenePointer = viewportCoordsToSceneCoords(event, ctx.getState());
  const { x: scenePointerX, y: scenePointerY } = scenePointer;
  ctx.setLastPointerMoveCoords({
    x: scenePointerX,
    y: scenePointerY,
  });

  const target = event.target as HTMLElement;
  if (target.setPointerCapture) {
    target.setPointerCapture(event.pointerId);
  }

  ctx.maybeCleanupAfterMissingPointerUp(event.nativeEvent);
  ctx.maybeUnfollowRemoteUser();

  if (ctx.getState().searchMatches) {
    ctx.setState((state) => {
      return {
        searchMatches: state.searchMatches && {
          focusedId: null,
          matches: state.searchMatches.matches.map((searchMatch) => ({
            ...searchMatch,
            focus: false,
          })),
        },
      };
    });
    ctx.updateEditorAtom(searchItemInFocusAtom, null);
  }

  if (editorJotaiStore.get(convertElementTypePopupAtom)) {
    ctx.updateEditorAtom(convertElementTypePopupAtom, null);
  }

  if (ctx.getState().contextMenu) {
    ctx.setState({ contextMenu: null });
  }

  if (ctx.getState().snapLines) {
    ctx.setAppState({ snapLines: [] });
  }

  if (ctx.getState().openPopup) {
    ctx.setState({ openPopup: null });
  }

  ctx.updateGestureOnPointerDown(event);

  if (
    event.pointerType === "touch" &&
    ctx.getState().newElement &&
    ctx.getState().newElement!.type === "freedraw"
  ) {
    const element = ctx.getState().newElement as ExcalidrawFreeDrawElement;
    ctx.updateScene({
      ...(element.points.length < 10
        ? {
            elements: ctx.scene
              .getElementsIncludingDeleted()
              .filter((el) => el.id !== element.id),
          }
        : {}),
      appState: {
        newElement: null,
        editingTextElement: null,
        startBoundElement: null,
        suggestedBinding: null,
        selectedElementIds: makeNextSelectedElementIds(
          Object.keys(ctx.getState().selectedElementIds)
            .filter((key) => key !== element.id)
            .reduce((obj: { [id: string]: true }, key) => {
              obj[key] = ctx.getState().selectedElementIds[key];
              return obj;
            }, {}),
          ctx.getState(),
        ),
      },
      captureUpdate:
        ctx.getState().openDialog?.name === "elementLinkSelector"
          ? CaptureUpdateAction.EVENTUALLY
          : CaptureUpdateAction.NEVER,
    });
    return;
  }

  const selection = document.getSelection();
  if (selection?.anchorNode) {
    selection.removeAllRanges();
  }
  ctx.maybeOpenContextMenuAfterPointerDownOnTouchDevices(event);

  if (!ctx.getState().penDetected && event.pointerType === "pen") {
    ctx.setState(() => {
      return {
        penMode: true,
        penDetected: true,
      };
    });
  }

  if (
    !ctx.editorInterface.isTouchScreen &&
    ["pen", "touch"].includes(event.pointerType)
  ) {
    ctx.setEditorInterface({ isTouchScreen: true });
  }

  if (ctx.getIsPanning()) {
    return;
  }

  ctx.setLastPointerDownEvent(event);

  if (ctx.handleCanvasPanUsingWheelOrSpaceDrag(event)) {
    return;
  }

  ctx.setState({
    lastPointerDownWith: event.pointerType,
    cursorButton: "down",
  });
  ctx.savePointer(event.clientX, event.clientY, "down");

  if (
    event.button === POINTER_BUTTON.ERASER &&
    ctx.getState().activeTool.type !== TOOL_TYPE.eraser
  ) {
    ctx.setState(
      {
        activeTool: updateActiveTool(ctx.getState(), {
          type: TOOL_TYPE.eraser,
          lastActiveToolBeforeEraser: ctx.getState().activeTool,
        }),
      },
      () => {
        ctx.handleCanvasPointerDown(event);
        const onPointerUp = () => {
          unsubPointerUp();
          unsubCleanup?.();
          if (isEraserActive(ctx.getState())) {
            ctx.setState({
              activeTool: updateActiveTool(ctx.getState(), {
                ...(ctx.getState().activeTool.lastActiveTool || {
                  type: TOOL_TYPE.selection,
                }),
                lastActiveToolBeforeEraser: null,
              }),
            });
          }
        };

        const unsubPointerUp = addEventListener(
          window,
          EVENT.POINTER_UP,
          onPointerUp,
          {
            once: true,
          },
        );
        let unsubCleanup: UnsubscribeCallback | undefined;
        requestAnimationFrame(() => {
          unsubCleanup = ctx.missingPointerEventCleanupEmitter_once(
            onPointerUp,
          );
        });
      },
    );
    return;
  }

  if (
    event.button !== POINTER_BUTTON.MAIN &&
    event.button !== POINTER_BUTTON.TOUCH &&
    event.button !== POINTER_BUTTON.ERASER
  ) {
    return;
  }

  if (ctx.getGesture().pointers.size > 1) {
    return;
  }

  const pointerDownState = ctx.initialPointerDownState(event);

  ctx.setState({
    selectedElementsAreBeingDragged: false,
  });

  if (
    ctx.handleTextAutoResizeHandlePointerDown(
      selectedElements,
      pointerDownState.origin,
    )
  ) {
    return;
  }

  if (ctx.handleDraggingScrollBar(event, pointerDownState)) {
    return;
  }

  ctx.clearSelectionIfNotUsingSelection();

  if (handleSelectionOnPointerDown(ctx, event, pointerDownState)) {
    return;
  }

  const allowOnPointerDown =
    !ctx.getState().penMode ||
    event.pointerType !== "touch" ||
    ctx.getState().activeTool.type === "selection" ||
    ctx.getState().activeTool.type === "lasso" ||
    ctx.getState().activeTool.type === "text" ||
    ctx.getState().activeTool.type === "image";

  if (!allowOnPointerDown) {
    return;
  }

  if (ctx.getState().activeTool.type === "lasso") {
    const hitSelectedElement =
      pointerDownState.hit.element &&
      ctx.isASelectedElement(pointerDownState.hit.element);
    const shouldForceLassoReselect =
      event.altKey &&
      event[KEYS.CTRL_OR_CMD] &&
      !pointerDownState.resize.handleType;
    const shouldStartLassoSelection =
      shouldForceLassoReselect ||
      (!pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements &&
        !pointerDownState.resize.handleType &&
        !hitSelectedElement);

    if (shouldStartLassoSelection) {
      if (!ctx.lassoTrail.hasCurrentTrail) {
        ctx.lassoTrail.startPath(
          pointerDownState.origin.x,
          pointerDownState.origin.y,
          event.shiftKey,
        );
      }

      pointerDownState.drag.blockDragging =
        ctx.editorInterface.formFactor === "desktop";
    }

    if (
      ctx.editorInterface.formFactor !== "desktop" &&
      pointerDownState.hit.element &&
      !hitSelectedElement
    ) {
      ctx.setState((prevState) => {
        const nextSelectedElementIds: { [id: string]: true } = {
          ...prevState.selectedElementIds,
          [pointerDownState.hit.element!.id]: true,
        };

        const previouslySelectedElements: ExcalidrawElement[] = [];

        Object.keys(prevState.selectedElementIds).forEach((id) => {
          const element = ctx.scene.getElement(id);
          element && previouslySelectedElements.push(element);
        });

        const hitElement = pointerDownState.hit.element!;

        if (isFrameLikeElement(hitElement)) {
          getFrameChildren(previouslySelectedElements, hitElement.id).forEach(
            (element) => {
              delete nextSelectedElementIds[element.id];
            },
          );
        } else if (hitElement.frameId) {
          if (nextSelectedElementIds[hitElement.frameId]) {
            delete nextSelectedElementIds[hitElement.id];
          }
        } else {
          const groupIds = hitElement.groupIds;
          const framesInGroups = new Set(
            groupIds
              .flatMap((gid) =>
                getElementsInGroup(ctx.scene.getNonDeletedElements(), gid),
              )
              .filter((element) => isFrameLikeElement(element))
              .map((frame) => frame.id),
          );

          if (framesInGroups.size > 0) {
            previouslySelectedElements.forEach((element) => {
              if (element.frameId && framesInGroups.has(element.frameId)) {
                delete nextSelectedElementIds[element.id];
                element.groupIds
                  .flatMap((gid) =>
                    getElementsInGroup(
                      ctx.scene.getNonDeletedElements(),
                      gid,
                    ),
                  )
                  .forEach((element) => {
                    delete nextSelectedElementIds[element.id];
                  });
              }
            });
          }
        }

        return {
          ...selectGroupsForSelectedElements(
            {
              editingGroupId: prevState.editingGroupId,
              selectedElementIds: nextSelectedElementIds,
            },
            ctx.scene.getNonDeletedElements(),
            prevState,
            null,
          ),
          showHyperlinkPopup:
            hitElement.link || isEmbeddableElement(hitElement)
              ? "info"
              : false,
        };
      });
      pointerDownState.hit.wasAddedToSelection = true;
    }
  } else if (ctx.getState().activeTool.type === "text") {
    handleTextOnPointerDown(ctx, event, pointerDownState);
  } else if (
    ctx.getState().activeTool.type === "arrow" ||
    ctx.getState().activeTool.type === "line"
  ) {
    handleLinearElementOnPointerDown(
      ctx,
      event,
      ctx.getState().activeTool.type as "arrow" | "line",
      pointerDownState,
    );
  } else if (ctx.getState().activeTool.type === "freedraw") {
    handleFreeDrawElementOnPointerDown(
      ctx,
      event,
      ctx.getState().activeTool.type as "freedraw",
      pointerDownState,
    );
  } else if (ctx.getState().activeTool.type === "custom") {
    setCursorForShape(ctx.interactiveCanvas, ctx.getState());
  } else if (
    ctx.getState().activeTool.type === TOOL_TYPE.frame ||
    ctx.getState().activeTool.type === TOOL_TYPE.magicframe
  ) {
    createFrameElementOnPointerDown(
      ctx,
      pointerDownState,
      ctx.getState().activeTool.type as "frame" | "magicframe",
    );
  } else if (ctx.getState().activeTool.type === "laser") {
    ctx.laserTrails.startPath(
      pointerDownState.lastCoords.x,
      pointerDownState.lastCoords.y,
    );
  } else if (
    ctx.getState().activeTool.type !== "eraser" &&
    ctx.getState().activeTool.type !== "hand" &&
    ctx.getState().activeTool.type !== "image"
  ) {
    createGenericElementOnPointerDown(
      ctx,
      ctx.getState().activeTool.type as
        | "rectangle"
        | "diamond"
        | "ellipse"
        | "embeddable"
        | "selection",
      pointerDownState,
    );
  }

  ctx.propOnPointerDown?.(ctx.getState().activeTool, pointerDownState);
  ctx.onPointerDownEmitter_trigger(
    ctx.getState().activeTool,
    pointerDownState,
    event,
  );

  if (ctx.getState().activeTool.type === "eraser") {
    ctx.eraserTrail.startPath(
      pointerDownState.lastCoords.x,
      pointerDownState.lastCoords.y,
    );
  }

  const onPointerMove = onPointerMoveFromPointerDownHandler(
    ctx,
    pointerDownState,
  );

  const onPointerUp = onPointerUpFromPointerDownHandler(
    ctx,
    pointerDownState,
  );

  const onKeyDown = withBatchedUpdates((event: KeyboardEvent) => {
    if (maybeHandleResize(ctx, pointerDownState, event)) {
      return;
    }
    maybeDragNewGenericElement(ctx, pointerDownState, event);
  });
  const onKeyUp = withBatchedUpdates((event: KeyboardEvent) => {
    event.key === KEYS.ALT && event.preventDefault();
    if (maybeHandleResize(ctx, pointerDownState, event)) {
      return;
    }
    maybeDragNewGenericElement(ctx, pointerDownState, event);
  });

  ctx.missingPointerEventCleanupEmitter_once((_event) =>
    onPointerUp(_event || event.nativeEvent),
  );

  if (
    !ctx.getState().viewModeEnabled ||
    ctx.getState().activeTool.type === "laser"
  ) {
    window.addEventListener(EVENT.POINTER_MOVE, onPointerMove);
    window.addEventListener(EVENT.POINTER_UP, onPointerUp);
    window.addEventListener(EVENT.KEYDOWN, onKeyDown);
    window.addEventListener(EVENT.KEYUP, onKeyUp);
    pointerDownState.eventListeners.onMove = onPointerMove;
    pointerDownState.eventListeners.onUp = onPointerUp;
    pointerDownState.eventListeners.onKeyUp = onKeyUp;
    pointerDownState.eventListeners.onKeyDown = onKeyDown;
  }
}
