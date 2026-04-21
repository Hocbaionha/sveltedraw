import type React from "react";
import { flushSync } from "react-dom";

import {
  ARROW_TYPE,
  CURSOR_TYPE,
  FRAME_STYLE,
  KEYS,
  LINE_CONFIRM_THRESHOLD,
  ROUNDNESS,
  TOOL_TYPE,
  getFeatureFlag,
  getGridPoint,
  invariant,
  isSelectionLikeTool,
  shouldRotateWithDiscreteAngle,
  tupleToCoors,
  updateActiveTool,
} from "@excalidraw/common";

import {
  LinearElementEditor,
  bindOrUnbindBindingElement,
  editGroupForSelectedElement,
  getCommonBounds,
  getElementWithTransformHandleType,
  getElementsInGroup,
  getFrameChildren,
  getHoveredElementForBinding,
  getResizeArrowDirection,
  getResizeOffsetXY,
  getSnapOutlineMidPoint,
  getTransformHandleTypeFromCoords,
  handleFocusPointPointerDown,
  hasBoundTextElement,
  isBindingElement,
  isBindingEnabled,
  isElbowArrow,
  isElementInGroup,
  isEmbeddableElement,
  isFrameLikeElement,
  isLinearElement,
  isPathALoop,
  isUsingAdaptiveRadius,
  makeNextSelectedElementIds,
  newArrowElement,
  newElement,
  newEmbeddableElement,
  newFrameElement,
  newFreeDrawElement,
  newLinearElement,
  newMagicFrameElement,
  selectGroupsForSelectedElements,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawGenericElement,
  ExcalidrawLinearElement,
  ExcalidrawTextContainer,
  NonDeleted,
} from "@excalidraw/element/types";

import { pointDistance, pointFrom } from "@excalidraw/math";
import type { GlobalPoint, LocalPoint } from "@excalidraw/math";

import { actionFinalize } from "../actions";
import { resetCursor, setCursor } from "../cursor";
import type { PointerDownState, ToolType } from "../types";

import type { AppEngineContext } from "./AppEngineContext";

export function handleTextOnPointerDown(
  ctx: AppEngineContext,
  event: React.PointerEvent<HTMLElement>,
  pointerDownState: PointerDownState,
): void {
  const state = ctx.getState();
  // if we're currently still editing text, clicking outside
  // should only finalize it, not create another (irrespective
  // of state.activeTool.locked)
  if (state.editingTextElement) {
    return;
  }
  let sceneX = pointerDownState.origin.x;
  let sceneY = pointerDownState.origin.y;

  const element = ctx.getElementAtPosition(sceneX, sceneY, {
    includeBoundTextElement: true,
  });

  // FIXME
  let container = ctx.getTextBindableContainerAtPosition(sceneX, sceneY);

  if (hasBoundTextElement(element)) {
    container = element as ExcalidrawTextContainer;
    sceneX = element.x + element.width / 2;
    sceneY = element.y + element.height / 2;
  }
  ctx.startTextEditing({
    sceneX,
    sceneY,
    insertAtParentCenter: !event.altKey,
    container,
    autoEdit: false,
    initialCaretSceneCoords: { x: sceneX, y: sceneY },
  });

  resetCursor(ctx.interactiveCanvas);
  if (!state.activeTool.locked) {
    ctx.setState({
      activeTool: updateActiveTool(state, {
        type: state.preferredSelectionTool.type,
      }),
    });
  }
}

export function handleFreeDrawElementOnPointerDown(
  ctx: AppEngineContext,
  event: React.PointerEvent<HTMLElement>,
  elementType: ExcalidrawFreeDrawElement["type"],
  pointerDownState: PointerDownState,
): void {
  // Begin a mark capture. This does not have to update state yet.
  const [gridX, gridY] = getGridPoint(
    pointerDownState.origin.x,
    pointerDownState.origin.y,
    null,
  );

  const topLayerFrame = ctx.getTopLayerFrameAtSceneCoords({
    x: gridX,
    y: gridY,
  });

  const state = ctx.getState();
  const simulatePressure = event.pressure === 0.5;

  const element = newFreeDrawElement({
    type: elementType,
    x: gridX,
    y: gridY,
    strokeColor: state.currentItemStrokeColor,
    backgroundColor: state.currentItemBackgroundColor,
    fillStyle: state.currentItemFillStyle,
    strokeWidth: state.currentItemStrokeWidth,
    strokeStyle: state.currentItemStrokeStyle,
    roughness: state.currentItemRoughness,
    opacity: state.currentItemOpacity,
    roundness: null,
    simulatePressure,
    locked: false,
    frameId: topLayerFrame ? topLayerFrame.id : null,
    points: [pointFrom<LocalPoint>(0, 0)],
    pressures: simulatePressure ? [] : [event.pressure],
  });

  ctx.scene.insertElement(element);

  ctx.setState((prevState) => {
    const nextSelectedElementIds = {
      ...prevState.selectedElementIds,
    };
    delete nextSelectedElementIds[element.id];
    return {
      selectedElementIds: makeNextSelectedElementIds(
        nextSelectedElementIds,
        prevState,
      ),
    };
  });

  const boundElement = getHoveredElementForBinding(
    pointFrom<GlobalPoint>(
      pointerDownState.origin.x,
      pointerDownState.origin.y,
    ),
    ctx.scene.getNonDeletedElements(),
    ctx.scene.getNonDeletedElementsMap(),
  );

  ctx.setState({
    newElement: element,
    startBoundElement: boundElement,
    suggestedBinding: null,
  });
}

export function createGenericElementOnPointerDown(
  ctx: AppEngineContext,
  elementType: ExcalidrawGenericElement["type"] | "embeddable",
  pointerDownState: PointerDownState,
): void {
  const lastPointerDownEvent = ctx.getLastPointerDownEvent();
  const [gridX, gridY] = getGridPoint(
    pointerDownState.origin.x,
    pointerDownState.origin.y,
    lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
      ? null
      : ctx.getEffectiveGridSize(),
  );

  const topLayerFrame = ctx.getTopLayerFrameAtSceneCoords({
    x: gridX,
    y: gridY,
  });

  const state = ctx.getState();
  const currentRoundness =
    state.currentItemRoundness === "round"
      ? {
          type: isUsingAdaptiveRadius(elementType as Parameters<typeof isUsingAdaptiveRadius>[0])
            ? ROUNDNESS.ADAPTIVE_RADIUS
            : ROUNDNESS.PROPORTIONAL_RADIUS,
        }
      : null;

  const baseElementAttributes = {
    x: gridX,
    y: gridY,
    strokeColor: state.currentItemStrokeColor,
    backgroundColor: state.currentItemBackgroundColor,
    fillStyle: state.currentItemFillStyle,
    strokeWidth: state.currentItemStrokeWidth,
    strokeStyle: state.currentItemStrokeStyle,
    roughness: state.currentItemRoughness,
    opacity: state.currentItemOpacity,
    roundness: currentRoundness,
    locked: false,
    frameId: topLayerFrame ? topLayerFrame.id : null,
  } as const;

  let element;
  if (elementType === "embeddable") {
    element = newEmbeddableElement({
      type: "embeddable",
      ...baseElementAttributes,
    });
  } else {
    element = newElement({
      type: elementType,
      ...baseElementAttributes,
    });
  }

  if (element.type === "selection") {
    ctx.setState({
      selectionElement: element,
    });
  } else {
    ctx.scene.insertElement(element);
    ctx.setState({
      multiElement: null,
      newElement: element,
    });
  }
}

export function createFrameElementOnPointerDown(
  ctx: AppEngineContext,
  pointerDownState: PointerDownState,
  type: Extract<ToolType, "frame" | "magicframe">,
): void {
  const lastPointerDownEvent = ctx.getLastPointerDownEvent();
  const [gridX, gridY] = getGridPoint(
    pointerDownState.origin.x,
    pointerDownState.origin.y,
    lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
      ? null
      : ctx.getEffectiveGridSize(),
  );

  const state = ctx.getState();
  const constructorOpts = {
    x: gridX,
    y: gridY,
    opacity: state.currentItemOpacity,
    locked: false,
    ...FRAME_STYLE,
  } as const;

  const frame =
    type === TOOL_TYPE.magicframe
      ? newMagicFrameElement(constructorOpts)
      : newFrameElement(constructorOpts);

  ctx.scene.insertElement(frame);

  ctx.setState({
    multiElement: null,
    newElement: frame,
  });
}

export function handleLinearElementOnPointerDown(
  ctx: AppEngineContext,
  event: React.PointerEvent<HTMLElement>,
  elementType: ExcalidrawLinearElement["type"],
  pointerDownState: PointerDownState,
): void {
  if (event.ctrlKey) {
    flushSync(() => {
      ctx.setState({
        isBindingEnabled: ctx.getState().bindingPreference !== "enabled",
      });
    });
  }

  const stateAfterFlush = ctx.getState();
  if (stateAfterFlush.multiElement) {
    const { multiElement, selectedLinearElement } = stateAfterFlush;

    invariant(
      selectedLinearElement,
      "selectedLinearElement is expected to be set",
    );

    // finalize if completing a loop
    if (
      multiElement.type === "line" &&
      isPathALoop(multiElement.points, stateAfterFlush.zoom.value)
    ) {
      flushSync(() => {
        ctx.setState({
          selectedLinearElement: {
            ...selectedLinearElement,
            lastCommittedPoint:
              multiElement.points[multiElement.points.length - 1],
            initialState: {
              ...selectedLinearElement.initialState,
              lastClickedPoint: -1, // Disable dragging
            },
          },
        });
      });
      ctx.actionManager.executeAction(actionFinalize);
      return;
    }

    // Elbow arrows cannot be created by putting down points
    // only the start and end points can be defined
    if (isElbowArrow(multiElement) && multiElement.points.length > 1) {
      ctx.actionManager.executeAction(actionFinalize, "ui", {
        event: event.nativeEvent,
        sceneCoords: {
          x: pointerDownState.origin.x,
          y: pointerDownState.origin.y,
        },
      });
      return;
    }

    const { x: rx, y: ry } = multiElement;
    const { lastCommittedPoint } = selectedLinearElement;

    const lastPointerMoveCoords = ctx.getLastPointerMoveCoords();
    const hoveredElementForBinding =
      isBindingEnabled(stateAfterFlush) &&
      getHoveredElementForBinding(
        pointFrom<GlobalPoint>(
          lastPointerMoveCoords?.x ??
            rx + multiElement.points[multiElement.points.length - 1][0],
          lastPointerMoveCoords?.y ??
            ry + multiElement.points[multiElement.points.length - 1][1],
        ),
        ctx.scene.getNonDeletedElements(),
        ctx.scene.getNonDeletedElementsMap(),
      );

    // clicking inside commit zone → finalize arrow
    if (
      (isBindingElement(multiElement) && hoveredElementForBinding) ||
      (multiElement.points.length > 1 &&
        lastCommittedPoint &&
        pointDistance(
          pointFrom(
            pointerDownState.origin.x - rx,
            pointerDownState.origin.y - ry,
          ),
          lastCommittedPoint,
        ) < LINE_CONFIRM_THRESHOLD)
    ) {
      ctx.actionManager.executeAction(actionFinalize, "ui", {
        event: event.nativeEvent,
        sceneCoords: {
          x: pointerDownState.origin.x,
          y: pointerDownState.origin.y,
        },
      });
      return;
    }

    ctx.setState((prevState) => ({
      selectedElementIds: makeNextSelectedElementIds(
        {
          ...prevState.selectedElementIds,
          [multiElement.id]: true,
        },
        prevState,
      ),
    }));

    setCursor(ctx.interactiveCanvas, CURSOR_TYPE.POINTER);
  } else {
    const [gridX, gridY] = getGridPoint(
      pointerDownState.origin.x,
      pointerDownState.origin.y,
      event[KEYS.CTRL_OR_CMD] ? null : ctx.getEffectiveGridSize(),
    );

    const topLayerFrame = ctx.getTopLayerFrameAtSceneCoords({
      x: gridX,
      y: gridY,
    });

    /* If arrow is pre-arrowheads, it will have undefined for both start and end arrowheads.
    If so, we want it to be null for start and "arrow" for end. If the linear item is not
    an arrow, we want it to be null for both. Otherwise, we want it to use the
    values from appState. */

    const state = ctx.getState();
    const { currentItemStartArrowhead, currentItemEndArrowhead } = state;
    const [startArrowhead, endArrowhead] =
      elementType === "arrow"
        ? [currentItemStartArrowhead, currentItemEndArrowhead]
        : [null, null];

    const element =
      elementType === "arrow"
        ? newArrowElement({
            type: elementType,
            x: gridX,
            y: gridY,
            strokeColor: state.currentItemStrokeColor,
            backgroundColor: state.currentItemBackgroundColor,
            fillStyle: state.currentItemFillStyle,
            strokeWidth: state.currentItemStrokeWidth,
            strokeStyle: state.currentItemStrokeStyle,
            roughness: state.currentItemRoughness,
            opacity: state.currentItemOpacity,
            roundness:
              state.currentItemArrowType === ARROW_TYPE.round
                ? { type: ROUNDNESS.PROPORTIONAL_RADIUS }
                : // note, roundness doesn't have any effect for elbow arrows,
                  // but it's best to set it to null as well
                  null,
            startArrowhead,
            endArrowhead,
            locked: false,
            frameId: topLayerFrame ? topLayerFrame.id : null,
            elbowed: state.currentItemArrowType === ARROW_TYPE.elbow,
            fixedSegments:
              state.currentItemArrowType === ARROW_TYPE.elbow ? [] : null,
          })
        : newLinearElement({
            type: elementType,
            x: gridX,
            y: gridY,
            strokeColor: state.currentItemStrokeColor,
            backgroundColor: state.currentItemBackgroundColor,
            fillStyle: state.currentItemFillStyle,
            strokeWidth: state.currentItemStrokeWidth,
            strokeStyle: state.currentItemStrokeStyle,
            roughness: state.currentItemRoughness,
            opacity: state.currentItemOpacity,
            roundness:
              state.currentItemRoundness === "round"
                ? { type: ROUNDNESS.PROPORTIONAL_RADIUS }
                : null,
            locked: false,
            frameId: topLayerFrame ? topLayerFrame.id : null,
          });

    const point = pointFrom<GlobalPoint>(
      pointerDownState.origin.x,
      pointerDownState.origin.y,
    );
    const elementsMap = ctx.scene.getNonDeletedElementsMap();
    const boundElement = isBindingEnabled(state)
      ? getHoveredElementForBinding(
          point,
          ctx.scene.getNonDeletedElements(),
          elementsMap,
        )
      : null;

    ctx.scene.mutateElement(element, {
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(0, 0)],
    });

    ctx.scene.insertElement(element);

    if (isBindingElement(element)) {
      // Do the initial binding so the binding strategy has the initial state
      bindOrUnbindBindingElement(
        element,
        new Map([
          [
            0,
            {
              point: pointFrom<LocalPoint>(0, 0),
              isDragging: false,
            },
          ],
        ]),
        point[0],
        point[1],
        ctx.scene,
        ctx.getState(),
        {
          newArrow: true,
          altKey: event.altKey,
          initialBinding: true,
          angleLocked: shouldRotateWithDiscreteAngle(event.nativeEvent),
        },
      );
    }

    // NOTE: We need the flushSync here for the
    // delayed bind mode change to see the right state
    // (specifically the `newElement`)
    flushSync(() => {
      ctx.setState((prevState) => {
        let linearElementEditor = null;
        let nextSelectedElementIds = prevState.selectedElementIds;
        if (isLinearElement(element)) {
          linearElementEditor = new LinearElementEditor(
            element,
            ctx.scene.getNonDeletedElementsMap(),
          );

          const endIdx = element.points.length - 1;
          linearElementEditor = {
            ...linearElementEditor,
            selectedPointsIndices: [endIdx],
            initialState: {
              ...linearElementEditor.initialState,
              arrowStartIsInside: event.altKey,
              lastClickedPoint: endIdx,
              origin: pointFrom<GlobalPoint>(
                pointerDownState.origin.x,
                pointerDownState.origin.y,
              ),
            },
          };
        }

        nextSelectedElementIds = !ctx.getState().activeTool.locked
          ? makeNextSelectedElementIds({ [element.id]: true }, prevState)
          : prevState.selectedElementIds;

        return {
          ...prevState,
          bindMode: "orbit",
          newElement: element,
          startBoundElement: boundElement,
          suggestedBinding:
            boundElement && isBindingElement(element)
              ? {
                  element: boundElement,
                  midPoint: getSnapOutlineMidPoint(
                    point,
                    boundElement,
                    elementsMap,
                    ctx.getState().zoom,
                  ),
                }
              : null,
          selectedElementIds: nextSelectedElementIds,
          selectedLinearElement: linearElementEditor,
        };
      });
    });

    if (isBindingElement(element) && getFeatureFlag("COMPLEX_BINDINGS")) {
      ctx.handleDelayedBindModeChange(element, boundElement);
    }
  }
}

/**
 * @returns whether the pointer event has been completely handled
 */
export function handleSelectionOnPointerDown(
  ctx: AppEngineContext,
  event: React.PointerEvent<HTMLElement>,
  pointerDownState: PointerDownState,
): boolean {
  const state = ctx.getState();
  if (isSelectionLikeTool(state.activeTool.type)) {
    const elements = ctx.scene.getNonDeletedElements();
    const elementsMap = ctx.scene.getNonDeletedElementsMap();
    const selectedElements = ctx.scene.getSelectedElements(ctx.getState());

    if (
      selectedElements.length === 1 &&
      !state.selectedLinearElement?.isEditing &&
      !isElbowArrow(selectedElements[0]) &&
      !(
        isLinearElement(selectedElements[0]) &&
        (ctx.editorInterface.userAgent.isMobileDevice ||
          selectedElements[0].points.length === 2)
      ) &&
      !(
        state.selectedLinearElement &&
        state.selectedLinearElement.hoverPointIndex !== -1
      )
    ) {
      const elementWithTransformHandleType = getElementWithTransformHandleType(
        elements,
        ctx.getState(),
        pointerDownState.origin.x,
        pointerDownState.origin.y,
        ctx.getState().zoom,
        event.pointerType,
        ctx.scene.getNonDeletedElementsMap(),
        ctx.editorInterface,
      );
      if (elementWithTransformHandleType != null) {
        if (
          elementWithTransformHandleType.transformHandleType === "rotation"
        ) {
          ctx.setState({
            resizingElement: elementWithTransformHandleType.element,
          });
          pointerDownState.resize.handleType =
            elementWithTransformHandleType.transformHandleType;
        } else if (ctx.getState().croppingElementId) {
          pointerDownState.resize.handleType =
            elementWithTransformHandleType.transformHandleType;
        } else {
          ctx.setState({
            resizingElement: elementWithTransformHandleType.element,
          });
          pointerDownState.resize.handleType =
            elementWithTransformHandleType.transformHandleType;
        }
      }
    } else if (selectedElements.length > 1) {
      pointerDownState.resize.handleType = getTransformHandleTypeFromCoords(
        getCommonBounds(selectedElements),
        pointerDownState.origin.x,
        pointerDownState.origin.y,
        ctx.getState().zoom,
        event.pointerType,
        ctx.editorInterface,
      );
    }
    if (pointerDownState.resize.handleType) {
      pointerDownState.resize.isResizing = true;
      pointerDownState.resize.offset = tupleToCoors(
        getResizeOffsetXY(
          pointerDownState.resize.handleType,
          selectedElements,
          elementsMap,
          pointerDownState.origin.x,
          pointerDownState.origin.y,
        ),
      );
      if (
        selectedElements.length === 1 &&
        isLinearElement(selectedElements[0]) &&
        selectedElements[0].points.length === 2
      ) {
        pointerDownState.resize.arrowDirection = getResizeArrowDirection(
          pointerDownState.resize.handleType,
          selectedElements[0],
        );
      }
    } else {
      if (ctx.getState().selectedLinearElement) {
        const linearElementEditor = ctx.getState().selectedLinearElement!;
        const ret = ctx.linearElementEditor_handlePointerDown(
          event,
          pointerDownState.origin,
          linearElementEditor,
        );
        if (ret.hitElement) {
          pointerDownState.hit.element = ret.hitElement;
        }
        if (ret.linearElementEditor) {
          ctx.setState({ selectedLinearElement: ret.linearElementEditor });
        }
        if (ret.didAddPoint) {
          return true;
        }

        // Also check at current pointer position if focus point is being hovered
        // (in case we're clicking directly without a prior move event)
        const elementsMapInner = ctx.scene.getNonDeletedElementsMap();
        const arrow = LinearElementEditor.getElement(
          linearElementEditor.elementId,
          elementsMapInner,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ) as any;

        if (arrow && isBindingElement(arrow)) {
          const { hitFocusPoint, pointerOffset } = handleFocusPointPointerDown(
            arrow,
            pointerDownState,
            elementsMapInner,
            ctx.getState(),
          );

          // If focus point is hit, update state and prevent element selection
          if (hitFocusPoint) {
            ctx.setState({
              selectedLinearElement: {
                ...linearElementEditor,
                hoveredFocusPointBinding: hitFocusPoint,
                draggedFocusPointBinding: hitFocusPoint,
                pointerOffset,
              },
            });
            return false;
          }
        }
      }

      const allHitElements = ctx.getElementsAtPosition(
        pointerDownState.origin.x,
        pointerDownState.origin.y,
        {
          includeLockedElements: true,
        },
      );
      const unlockedHitElements = allHitElements.filter((e) => !e.locked);

      // Cannot set preferSelected in getElementAtPosition as we do in pointer move; consider:
      // A & B: both unlocked, A selected, B on top, A & B overlaps in some way
      // we want to select B when clicking on the overlapping area
      const hitElementMightBeLocked = ctx.getElementAtPosition(
        pointerDownState.origin.x,
        pointerDownState.origin.y,
        {
          allHitElements,
        },
      );

      if (
        !hitElementMightBeLocked ||
        hitElementMightBeLocked.id !== ctx.getState().activeLockedId
      ) {
        ctx.setState({
          activeLockedId: null,
        });
      }

      if (
        hitElementMightBeLocked &&
        hitElementMightBeLocked.locked &&
        !unlockedHitElements.some(
          (el) => ctx.getState().selectedElementIds[el.id],
        )
      ) {
        pointerDownState.hit.element = null;
      } else {
        // hitElement may already be set above, so check first
        pointerDownState.hit.element =
          pointerDownState.hit.element ??
          ctx.getElementAtPosition(
            pointerDownState.origin.x,
            pointerDownState.origin.y,
          );
      }

      const hitLink = ctx.getElementLinkAtPosition(
        pointerDownState.origin,
        hitElementMightBeLocked,
      );
      ctx.setHitLinkElement(
        hitLink as NonDeleted<ExcalidrawElement> | undefined,
      );

      if (hitLink) {
        return true;
      }

      if (
        ctx.getState().croppingElementId &&
        pointerDownState.hit.element?.id !== ctx.getState().croppingElementId
      ) {
        ctx.finishImageCropping();
      }

      if (pointerDownState.hit.element) {
        // Early return if pointer is hitting link icon
        const hitLinkElement = ctx.getElementLinkAtPosition(
          {
            x: pointerDownState.origin.x,
            y: pointerDownState.origin.y,
          },
          pointerDownState.hit.element,
        );
        if (hitLinkElement) {
          return false;
        }
      }

      // For overlapped elements one position may hit
      // multiple elements
      pointerDownState.hit.allHitElements = unlockedHitElements;

      const hitElement = pointerDownState.hit.element;
      const someHitElementIsSelected =
        pointerDownState.hit.allHitElements.some((element) =>
          ctx.isASelectedElement(element),
        );
      if (
        (hitElement === null || !someHitElementIsSelected) &&
        !event.shiftKey &&
        !pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements &&
        (!ctx.getState().selectedLinearElement?.isEditing ||
          (hitElement &&
            hitElement?.id !== ctx.getState().selectedLinearElement?.elementId))
      ) {
        ctx.clearSelection(hitElement);
      }

      if (ctx.getState().selectedLinearElement?.isEditing) {
        ctx.setState((prevState) => ({
          selectedLinearElement: prevState.selectedLinearElement
            ? {
                ...prevState.selectedLinearElement,
                isEditing:
                  !!hitElement &&
                  hitElement.id ===
                    ctx.getState().selectedLinearElement?.elementId,
              }
            : null,
          selectedElementIds: prevState.selectedLinearElement
            ? makeNextSelectedElementIds(
                {
                  [prevState.selectedLinearElement.elementId]: true,
                },
                ctx.getState(),
              )
            : makeNextSelectedElementIds({}, prevState),
        }));
        // If we click on something
      } else if (hitElement != null) {
        // == deep selection ==
        // on CMD/CTRL, drill down to hit element regardless of groups etc.
        if (event[KEYS.CTRL_OR_CMD]) {
          if (event.altKey) {
            // ctrl + alt means we're lasso selecting - start lasso trail and switch to lasso tool

            // Close any open dialogs that might interfere with lasso selection
            if (ctx.getState().openDialog?.name === "elementLinkSelector") {
              ctx.setOpenDialog(null);
            }
            ctx.lassoTrail.startPath(
              pointerDownState.origin.x,
              pointerDownState.origin.y,
              event.shiftKey,
            );
            ctx.setActiveTool({ type: "lasso", fromSelection: true });
            return false;
          }
          if (!ctx.getState().selectedElementIds[hitElement.id]) {
            pointerDownState.hit.wasAddedToSelection = true;
          }
          ctx.setState((prevState) => ({
            ...editGroupForSelectedElement(prevState, hitElement),
            previousSelectedElementIds: ctx.getState().selectedElementIds,
          }));
          // mark as not completely handled so as to allow dragging etc.
          return false;
        }

        // deselect if item is selected
        // if shift is not clicked, this will always return true
        // otherwise, it will trigger selection based on current
        // state of the box
        if (!ctx.getState().selectedElementIds[hitElement.id]) {
          // if we are currently editing a group, exiting editing mode and deselect the group.
          const editingGroupId = ctx.getState().editingGroupId;
          if (
            editingGroupId &&
            !isElementInGroup(hitElement, editingGroupId)
          ) {
            ctx.setState({
              selectedElementIds: makeNextSelectedElementIds({}, ctx.getState()),
              selectedGroupIds: {},
              editingGroupId: null,
              activeEmbeddable: null,
            });
          }

          // Add hit element to selection. At this point if we're not holding
          // SHIFT the previously selected element(s) were deselected above
          // (make sure you use setState updater to use latest state)
          // With shift-selection, we want to make sure that frames and their containing
          // elements are not selected at the same time.
          if (
            !someHitElementIsSelected &&
            !pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements
          ) {
            ctx.setState((prevState) => {
              let nextSelectedElementIds: { [id: string]: true } = {
                ...prevState.selectedElementIds,
                [hitElement.id]: true,
              };

              const previouslySelectedElements: ExcalidrawElement[] = [];

              Object.keys(prevState.selectedElementIds).forEach((id) => {
                const element = ctx.scene.getElement(id);
                element && previouslySelectedElements.push(element);
              });

              // if hitElement is frame-like, deselect all of its elements
              // if they are selected
              if (isFrameLikeElement(hitElement)) {
                getFrameChildren(
                  previouslySelectedElements,
                  hitElement.id,
                ).forEach((element) => {
                  delete nextSelectedElementIds[element.id];
                });
              } else if (hitElement.frameId) {
                // if hitElement is in a frame and its frame has been selected
                // disable selection for the given element
                if (nextSelectedElementIds[hitElement.frameId]) {
                  delete nextSelectedElementIds[hitElement.id];
                }
              } else {
                // hitElement is neither a frame nor an element in a frame
                // but since hitElement could be in a group with some frames
                // this means selecting hitElement will have the frames selected as well
                // because we want to keep the invariant:
                // - frames and their elements are not selected at the same time
                // we deselect elements in those frames that were previously selected

                const groupIds = hitElement.groupIds;
                const framesInGroups = new Set(
                  groupIds
                    .flatMap((gid) =>
                      getElementsInGroup(
                        ctx.scene.getNonDeletedElements(),
                        gid,
                      ),
                    )
                    .filter((element) => isFrameLikeElement(element))
                    .map((frame) => frame.id),
                );

                if (framesInGroups.size > 0) {
                  previouslySelectedElements.forEach((element) => {
                    if (
                      element.frameId &&
                      framesInGroups.has(element.frameId)
                    ) {
                      // deselect element and groups containing the element
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

              // Finally, in shape selection mode, we'd like to
              // keep only one shape or group selected at a time.
              // This means, if the hitElement is a different shape or group
              // than the previously selected ones, we deselect the previous ones
              // and select the hitElement
              if (prevState.openDialog?.name === "elementLinkSelector") {
                if (
                  !hitElement.groupIds.some(
                    (gid) => prevState.selectedGroupIds[gid],
                  )
                ) {
                  nextSelectedElementIds = {
                    [hitElement.id]: true,
                  };
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
        }
      }

      ctx.setState({
        previousSelectedElementIds: ctx.getState().selectedElementIds,
      });
    }
  }
  return false;
}
