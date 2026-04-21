import { flushSync } from "react-dom";

import {
  KEYS,
  arrayToMap,
  getFeatureFlag,
  getGridPoint,
  invariant,
  isShallowEqual,
  randomInteger,
  tupleToCoors,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import {
  LinearElementEditor,
  deepCopyElement,
  dragSelectedElements,
  duplicateElements,
  getDragOffsetXY,
  getElementAbsoluteCoords,
  getElementsWithinSelection,
  getHoveredElementForBinding,
  getSelectionStateForElements,
  getUncroppedWidthAndHeight,
  handleFocusPointDrag,
  isBindableElement,
  isBindingElement,
  isEmbeddableElement,
  isFrameLikeElement,
  isImageElement,
  isInitializedImageElement,
  isLinearElement,
  isSomeElementSelected,
  newElementWith,
  selectGroupsForSelectedElements,
  syncMovedIndices,
  updateBoundElements,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  clamp,
  pointFrom,
  pointRotateRads,
  vector,
  vectorDot,
  vectorFromPoint,
  vectorNormalize,
  vectorSubtract,
} from "@excalidraw/math";
import type { GlobalPoint, LocalPoint } from "@excalidraw/math";

import { isEraserActive } from "../appState";
import { withBatchedUpdatesThrottled } from "../reactUtils";
import type { PointerDownState } from "../types";

import { createGenericElementOnPointerDown } from "./pointerDownSubOps";

import type { AppEngineContext } from "./AppEngineContext";

export function onPointerMoveFromPointerDownHandler(
  ctx: AppEngineContext,
  pointerDownState: PointerDownState,
) {
  return withBatchedUpdatesThrottled((event: PointerEvent) => {
    if (ctx.getState().openDialog?.name === "elementLinkSelector") {
      return;
    }
    const pointerCoords = viewportCoordsToSceneCoords(event, ctx.getState());

    if (ctx.getState().activeLockedId) {
      ctx.setState({
        activeLockedId: null,
      });
    }

    if (
      ctx.getState().selectedLinearElement &&
      ctx.getState().selectedLinearElement!.elbowed &&
      ctx.getState().selectedLinearElement!.initialState.segmentMidpoint.index
    ) {
      const [gridX, gridY] = getGridPoint(
        pointerCoords.x,
        pointerCoords.y,
        event[KEYS.CTRL_OR_CMD] ? null : ctx.getEffectiveGridSize(),
      );

      let index =
        ctx.getState().selectedLinearElement!.initialState.segmentMidpoint
          .index;
      if (index! < 0) {
        const nextCoords = LinearElementEditor.getSegmentMidpointHitCoords(
          {
            ...ctx.getState().selectedLinearElement!,
            segmentMidPointHoveredCoords: null,
          },
          { x: gridX, y: gridY },
          ctx.getState(),
          ctx.scene.getNonDeletedElementsMap(),
        );
        index = nextCoords
          ? LinearElementEditor.getSegmentMidPointIndex(
              ctx.getState().selectedLinearElement!,
              ctx.getState(),
              nextCoords,
              ctx.scene.getNonDeletedElementsMap(),
            )
          : -1;
      }

      const ret = LinearElementEditor.moveFixedSegment(
        ctx.getState().selectedLinearElement!,
        index!,
        gridX,
        gridY,
        ctx.scene,
      );

      ctx.setState({
        selectedLinearElement: {
          ...ctx.getState().selectedLinearElement!,
          isDragging: true,
          segmentMidPointHoveredCoords: ret.segmentMidPointHoveredCoords,
          initialState: ret.initialState,
        },
      });
      return;
    }

    const lastPointerCoords =
      ctx.getPreviousPointerMoveCoords() ?? pointerDownState.origin;
    ctx.setPreviousPointerMoveCoords(pointerCoords);

    // We need to initialize dragOffsetXY only after we've updated
    // `state.selectedElementIds` on pointerDown. Doing it here in pointerMove
    // event handler should hopefully ensure we're already working with
    // the updated state.
    if (pointerDownState.drag.offset === null) {
      pointerDownState.drag.offset = tupleToCoors(
        getDragOffsetXY(
          ctx.scene.getSelectedElements(ctx.getState()),
          pointerDownState.origin.x,
          pointerDownState.origin.y,
        ),
      );
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (ctx.handlePointerMoveOverScrollbars(event, pointerDownState)) {
      return;
    }

    if (isEraserActive(ctx.getState())) {
      ctx.handleEraser(event, pointerCoords);
      return;
    }

    if (ctx.getState().activeTool.type === "laser") {
      ctx.laserTrails.addPointToPath(pointerCoords.x, pointerCoords.y);
    }

    const [gridX, gridY] = getGridPoint(
      pointerCoords.x,
      pointerCoords.y,
      event[KEYS.CTRL_OR_CMD] ? null : ctx.getEffectiveGridSize(),
    );

    if (pointerDownState.resize.isResizing) {
      pointerDownState.lastCoords.x = pointerCoords.x;
      pointerDownState.lastCoords.y = pointerCoords.y;
      if (ctx.maybeHandleCrop(pointerDownState, event)) {
        return true;
      }
      if (ctx.maybeHandleResize(pointerDownState, event)) {
        return true;
      }
    }
    const elementsMap = ctx.scene.getNonDeletedElementsMap();

    if (ctx.getState().selectedLinearElement) {
      const linearElementEditor = ctx.getState().selectedLinearElement!;

      // Handle focus point dragging if needed
      if (linearElementEditor.draggedFocusPointBinding) {
        handleFocusPointDrag(
          linearElementEditor,
          elementsMap,
          pointerCoords,
          ctx.scene,
          ctx.getState(),
          ctx.getEffectiveGridSize(),
          event.altKey,
        );
        ctx.setState({
          selectedLinearElement: {
            ...linearElementEditor,
            isDragging: false,
            selectedPointsIndices: [],
            initialState: {
              ...linearElementEditor.initialState,
              lastClickedPoint: -1,
            },
          },
        });
        return;
      }

      if (
        LinearElementEditor.shouldAddMidpoint(
          ctx.getState().selectedLinearElement!,
          pointerCoords,
          ctx.getState(),
          elementsMap,
        )
      ) {
        const ret = ctx.linearElementEditor_addMidpoint(
          ctx.getState().selectedLinearElement!,
          pointerCoords,
          !event[KEYS.CTRL_OR_CMD],
        );
        if (!ret) {
          return;
        }

        // Since we are reading from previous state which is not possible with
        // automatic batching in React 18 hence using flush sync to synchronously
        // update the state. Check https://github.com/excalidraw/excalidraw/pull/5508 for more details.

        flushSync(() => {
          if (ctx.getState().selectedLinearElement) {
            ctx.setState({
              selectedLinearElement: {
                ...ctx.getState().selectedLinearElement!,
                initialState: ret.pointerDownState,
                selectedPointsIndices: ret.selectedPointsIndices,
                segmentMidPointHoveredCoords: null,
              },
            });
          }
        });

        return;
      } else if (
        linearElementEditor.initialState.segmentMidpoint.value !== null &&
        !linearElementEditor.initialState.segmentMidpoint.added
      ) {
        return;
      } else if (linearElementEditor.initialState.lastClickedPoint > -1) {
        const element = LinearElementEditor.getElement(
          linearElementEditor.elementId,
          elementsMap,
        );

        if (element?.isDeleted) {
          return;
        }

        if (isBindingElement(element)) {
          const hoveredElement = getHoveredElementForBinding(
            pointFrom<GlobalPoint>(pointerCoords.x, pointerCoords.y),
            ctx.scene.getNonDeletedElements(),
            elementsMap,
          );

          if (getFeatureFlag("COMPLEX_BINDINGS")) {
            ctx.handleDelayedBindModeChange(element, hoveredElement);
          }
        }

        if (
          event.altKey &&
          !ctx.getState().selectedLinearElement?.initialState
            ?.arrowStartIsInside &&
          getFeatureFlag("COMPLEX_BINDINGS")
        ) {
          ctx.handleSkipBindMode();
        }

        // Ignore drag requests if the arrow modification already happened
        if (linearElementEditor.initialState.lastClickedPoint === -1) {
          return;
        }

        const newState = ctx.linearElementEditor_handlePointDragging(
          event,
          pointerCoords.x,
          pointerCoords.y,
          linearElementEditor,
        );

        if (newState) {
          pointerDownState.lastCoords.x = pointerCoords.x;
          pointerDownState.lastCoords.y = pointerCoords.y;
          pointerDownState.drag.hasOccurred = true;

          // NOTE: Optimize setState calls because it
          // affects history and performance
          if (
            newState.suggestedBinding !== ctx.getState().suggestedBinding ||
            !isShallowEqual(
              newState.selectedLinearElement?.selectedPointsIndices ?? [],
              ctx.getState().selectedLinearElement?.selectedPointsIndices ?? [],
            ) ||
            newState.selectedLinearElement?.hoverPointIndex !==
              ctx.getState().selectedLinearElement?.hoverPointIndex ||
            newState.selectedLinearElement?.customLineAngle !==
              ctx.getState().selectedLinearElement?.customLineAngle ||
            ctx.getState().selectedLinearElement!.isDragging !==
              newState.selectedLinearElement?.isDragging ||
            ctx.getState().selectedLinearElement?.initialState?.altFocusPoint !==
              newState.selectedLinearElement?.initialState?.altFocusPoint
          ) {
            ctx.setState(newState);
          }

          return;
        }
      }
    }

    const hasHitASelectedElement = pointerDownState.hit.allHitElements.some(
      (element) => ctx.isASelectedElement(element),
    );

    const isSelectingPointsInLineEditor =
      ctx.getState().selectedLinearElement?.isEditing &&
      event.shiftKey &&
      ctx.getState().selectedLinearElement!.elementId ===
        pointerDownState.hit.element?.id;

    if (
      (hasHitASelectedElement ||
        pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements) &&
      !isSelectingPointsInLineEditor &&
      !pointerDownState.drag.blockDragging
    ) {
      const selectedElements = ctx.scene.getSelectedElements(ctx.getState());
      if (
        selectedElements.length > 0 &&
        selectedElements.every((element) => element.locked)
      ) {
        return;
      }

      const selectedElementsHasAFrame = selectedElements.find((e) =>
        isFrameLikeElement(e),
      );
      const topLayerFrame = ctx.getTopLayerFrameAtSceneCoords(pointerCoords);
      const frameToHighlight =
        topLayerFrame && !selectedElementsHasAFrame ? topLayerFrame : null;
      // Only update the state if there is a difference
      if (ctx.getState().frameToHighlight !== frameToHighlight) {
        flushSync(() => {
          ctx.setState({ frameToHighlight });
        });
      }

      // Marking that click was used for dragging to check
      // if elements should be deselected on pointerup
      pointerDownState.drag.hasOccurred = true;

      // prevent immediate dragging during lasso selection to avoid element displacement
      // only allow dragging if we're not in the middle of lasso selection
      // (on mobile, allow dragging if we hit an element)
      if (
        ctx.getState().activeTool.type === "lasso" &&
        ctx.lassoTrail.hasCurrentTrail &&
        !(
          ctx.editorInterface.formFactor !== "desktop" &&
          pointerDownState.hit.element
        ) &&
        !ctx.getState().activeTool.fromSelection
      ) {
        return;
      }

      // Clear lasso trail when starting to drag selected elements with lasso tool
      // Only clear if we're actually dragging (not during lasso selection)
      if (
        ctx.getState().activeTool.type === "lasso" &&
        selectedElements.length > 0 &&
        pointerDownState.drag.hasOccurred &&
        !ctx.getState().activeTool.fromSelection
      ) {
        ctx.lassoTrail.endPath();
      }

      // prevent dragging even if we're no longer holding cmd/ctrl otherwise
      // it would have weird results (stuff jumping all over the screen)
      // Checking for editingTextElement to avoid jump while editing on mobile #6503
      if (
        selectedElements.length > 0 &&
        !pointerDownState.withCmdOrCtrl &&
        !ctx.getState().editingTextElement &&
        ctx.getState().activeEmbeddable?.state !== "active"
      ) {
        const dragOffset = {
          x: pointerCoords.x - pointerDownState.drag.origin.x,
          y: pointerCoords.y - pointerDownState.drag.origin.y,
        };

        const originalElements = [
          ...pointerDownState.originalElements.values(),
        ];

        // We only drag in one direction if shift is pressed
        const lockDirection = event.shiftKey;

        if (lockDirection) {
          const distanceX = Math.abs(dragOffset.x);
          const distanceY = Math.abs(dragOffset.y);

          const lockX = lockDirection && distanceX < distanceY;
          const lockY = lockDirection && distanceX > distanceY;

          if (lockX) {
            dragOffset.x = 0;
          }

          if (lockY) {
            dragOffset.y = 0;
          }
        }

        // #region move crop region
        if (ctx.getState().croppingElementId) {
          const croppingElement = ctx.scene
            .getNonDeletedElementsMap()
            .get(ctx.getState().croppingElementId!);

          if (
            croppingElement &&
            isImageElement(croppingElement) &&
            croppingElement.crop !== null &&
            pointerDownState.hit.element === croppingElement
          ) {
            const crop = croppingElement.crop;
            const image =
              isInitializedImageElement(croppingElement) &&
              ctx.imageCache.get(croppingElement.fileId)?.image;

            if (image && !(image instanceof Promise)) {
              const uncroppedSize = getUncroppedWidthAndHeight(croppingElement);
              const instantDragOffset = vector(
                pointerCoords.x - lastPointerCoords.x,
                pointerCoords.y - lastPointerCoords.y,
              );

              // to reduce cursor:image drift, we need to take into account
              // the canvas image element scaling so we can accurately
              // track the pixels on movement
              instantDragOffset[0] *=
                image.naturalWidth / uncroppedSize.width;
              instantDragOffset[1] *=
                image.naturalHeight / uncroppedSize.height;

              const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
                croppingElement,
                elementsMap,
              );

              const topLeft = vectorFromPoint(
                pointRotateRads(
                  pointFrom(x1, y1),
                  pointFrom(cx, cy),
                  croppingElement.angle,
                ),
              );
              const topRight = vectorFromPoint(
                pointRotateRads(
                  pointFrom(x2, y1),
                  pointFrom(cx, cy),
                  croppingElement.angle,
                ),
              );
              const bottomLeft = vectorFromPoint(
                pointRotateRads(
                  pointFrom(x1, y2),
                  pointFrom(cx, cy),
                  croppingElement.angle,
                ),
              );
              const topEdge = vectorNormalize(
                vectorSubtract(topRight, topLeft),
              );
              const leftEdge = vectorNormalize(
                vectorSubtract(bottomLeft, topLeft),
              );

              // project instantDrafOffset onto leftEdge and topEdge to decompose
              const offsetVector = vector(
                vectorDot(instantDragOffset, topEdge),
                vectorDot(instantDragOffset, leftEdge),
              );

              const nextCrop = {
                ...crop,
                x: clamp(
                  crop.x -
                    offsetVector[0] * Math.sign(croppingElement.scale[0]),
                  0,
                  image.naturalWidth - crop.width,
                ),
                y: clamp(
                  crop.y -
                    offsetVector[1] * Math.sign(croppingElement.scale[1]),
                  0,
                  image.naturalHeight - crop.height,
                ),
              };

              ctx.scene.mutateElement(croppingElement, {
                crop: nextCrop,
              });

              return;
            }
          }
        }

        // Snap cache *must* be synchronously popuplated before initial drag,
        // otherwise the first drag even will not snap, causing a jump before
        // it snaps to its position if previously snapped already.
        ctx.maybeCacheVisibleGaps(event, selectedElements);
        ctx.maybeCacheReferenceSnapPoints(event, selectedElements);

        const { snapOffset, snapLines } = ctx.snapDraggedElements(
          originalElements,
          dragOffset,
          event,
        );

        ctx.setState({ snapLines });

        // when we're editing the name of a frame, we want the user to be
        // able to select and interact with the text input
        if (!ctx.getState().editingFrame) {
          dragSelectedElements(
            pointerDownState,
            selectedElements,
            dragOffset,
            ctx.scene,
            snapOffset,
            event[KEYS.CTRL_OR_CMD] ? null : ctx.getEffectiveGridSize(),
          );
        }

        ctx.setState({
          selectedElementsAreBeingDragged: true,
          // element is being dragged and selectionElement that was created on pointer down
          // should be removed
          selectionElement: null,
        });

        // We duplicate the selected element if alt is pressed on pointer move
        if (event.altKey && !pointerDownState.hit.hasBeenDuplicated) {
          // Move the currently selected elements to the top of the z index stack, and
          // put the duplicates where the selected elements used to be.
          // (the origin point where the dragging started)

          pointerDownState.hit.hasBeenDuplicated = true;

          const elements = ctx.scene.getElementsIncludingDeleted();
          const hitElement = pointerDownState.hit.element;
          const selectedElementsAlt = ctx.scene.getSelectedElements({
            selectedElementIds: ctx.getState().selectedElementIds,
            includeBoundTextElement: true,
            includeElementsInFrames: true,
          });
          if (
            hitElement &&
            // hit element may not end up being selected
            // if we're alt-dragging a common bounding box
            // over the hit element
            pointerDownState.hit.wasAddedToSelection &&
            !selectedElementsAlt.find((el) => el.id === hitElement.id)
          ) {
            selectedElementsAlt.push(hitElement);
          }

          const idsOfElementsToDuplicate = new Map(
            selectedElementsAlt.map((el) => [el.id, el]),
          );

          const {
            duplicatedElements,
            duplicateElementsMap,
            elementsWithDuplicates,
            origIdToDuplicateId,
          } = duplicateElements({
            type: "in-place",
            elements,
            appState: ctx.getState(),
            randomizeSeed: true,
            idsOfElementsToDuplicate,
            overrides: ({ duplicateElement, origElement }) => {
              return {
                // reset to the original element's frameId (unless we've
                // duplicated alongside a frame in which case we need to
                // keep the duplicate frame's id) so that the element
                // frame membership is refreshed on pointerup
                // NOTE this is a hacky solution and should be done
                // differently
                frameId: duplicateElement.frameId ?? origElement.frameId,
                seed: randomInteger(),
              };
            },
          });
          duplicatedElements.forEach((element) => {
            pointerDownState.originalElements.set(
              element.id,
              deepCopyElement(element),
            );
          });

          const mappedClonedElements = elementsWithDuplicates.map((el) => {
            if (idsOfElementsToDuplicate.has(el.id)) {
              const origEl = pointerDownState.originalElements.get(el.id);

              if (origEl) {
                return newElementWith(el, {
                  x: origEl.x,
                  y: origEl.y,
                });
              }
            }
            return el;
          });

          const mappedNewSceneElements = ctx.onDuplicate?.(
            mappedClonedElements,
            elements,
          );

          const elementsWithIndices = syncMovedIndices(
            mappedNewSceneElements || mappedClonedElements,
            arrayToMap(duplicatedElements),
          );

          // we need to update synchronously so as to keep pointerDownState,
          // appState, and scene elements in sync
          flushSync(() => {
            // swap hit element with the duplicated one
            if (pointerDownState.hit.element) {
              const cloneId = origIdToDuplicateId.get(
                pointerDownState.hit.element.id,
              );
              const clonedElement =
                cloneId && duplicateElementsMap.get(cloneId);
              pointerDownState.hit.element = clonedElement || null;
            }
            // swap hit elements with the duplicated ones
            pointerDownState.hit.allHitElements =
              pointerDownState.hit.allHitElements.reduce(
                (
                  acc: typeof pointerDownState.hit.allHitElements,
                  origHitElement,
                ) => {
                  const cloneId = origIdToDuplicateId.get(origHitElement.id);
                  const clonedElement =
                    cloneId && duplicateElementsMap.get(cloneId);
                  if (clonedElement) {
                    acc.push(clonedElement);
                  }

                  return acc;
                },
                [],
              );

            // update drag origin to the position at which we started
            // the duplication so that the drag offset is correct
            pointerDownState.drag.origin = viewportCoordsToSceneCoords(
              event,
              ctx.getState(),
            );

            // switch selected elements to the duplicated ones
            ctx.setState((prevState) => ({
              ...getSelectionStateForElements(
                duplicatedElements,
                ctx.scene.getNonDeletedElements(),
                prevState,
              ),
            }));

            ctx.scene.replaceAllElements(elementsWithIndices);
            selectedElementsAlt.forEach((element) => {
              if (
                isBindableElement(element) &&
                element.boundElements?.some((other) => other.type === "arrow")
              ) {
                updateBoundElements(element, ctx.scene);
              }
            });

            ctx.maybeCacheVisibleGaps(event, selectedElementsAlt, true);
            ctx.maybeCacheReferenceSnapPoints(event, selectedElementsAlt, true);
          });
        }

        return;
      }
    }

    if (ctx.getState().selectionElement) {
      pointerDownState.lastCoords.x = pointerCoords.x;
      pointerDownState.lastCoords.y = pointerCoords.y;
      if (event.altKey) {
        ctx.setActiveTool(
          { type: "lasso", fromSelection: true },
          event.shiftKey,
        );
        ctx.lassoTrail.startPath(
          pointerDownState.origin.x,
          pointerDownState.origin.y,
          event.shiftKey,
        );
        ctx.setState({
          selectionElement: null,
        });
        return;
      }
      ctx.maybeDragNewGenericElement(pointerDownState, event);
    } else if (ctx.getState().activeTool.type === "lasso") {
      if (!event.altKey && ctx.getState().activeTool.fromSelection) {
        ctx.setActiveTool({ type: "selection" });
        createGenericElementOnPointerDown(ctx, "selection", pointerDownState);
        pointerDownState.lastCoords.x = pointerCoords.x;
        pointerDownState.lastCoords.y = pointerCoords.y;
        ctx.maybeDragNewGenericElement(pointerDownState, event);
        ctx.lassoTrail.endPath();
      } else {
        ctx.lassoTrail.addPointToPath(
          pointerCoords.x,
          pointerCoords.y,
          event.shiftKey,
        );
      }
    } else {
      // It is very important to read state within each move event,
      // otherwise we would read a stale one!
      const newElement = ctx.getState().newElement;

      if (!newElement) {
        return;
      }

      if (newElement.type === "freedraw") {
        const points = newElement.points;
        const dx = pointerCoords.x - newElement.x;
        const dy = pointerCoords.y - newElement.y;

        const lastPoint = points.length > 0 && points[points.length - 1];
        const discardPoint =
          lastPoint && lastPoint[0] === dx && lastPoint[1] === dy;

        if (!discardPoint) {
          const pressures = newElement.simulatePressure
            ? newElement.pressures
            : [...newElement.pressures, event.pressure];

          ctx.scene.mutateElement(
            newElement,
            {
              points: [...points, pointFrom<LocalPoint>(dx, dy)],
              pressures,
            },
            {
              informMutation: false,
              isDragging: false,
            },
          );

          ctx.setState({
            newElement,
          });
        }
      } else if (isLinearElement(newElement) && !newElement.isDeleted) {
        pointerDownState.drag.hasOccurred = true;
        const points = newElement.points;

        invariant(
          points.length > 1,
          "Do not create linear elements with less than 2 points",
        );

        let linearElementEditor = ctx.getState().selectedLinearElement;
        if (!linearElementEditor) {
          linearElementEditor = new LinearElementEditor(
            newElement,
            ctx.scene.getNonDeletedElementsMap(),
          );
          linearElementEditor = {
            ...linearElementEditor,
            selectedPointsIndices: [1],
            initialState: {
              ...linearElementEditor.initialState,
              lastClickedPoint: 1,
            },
          };
        }
        ctx.setState({
          newElement,
          ...ctx.linearElementEditor_handlePointDragging(
            event,
            gridX,
            gridY,
            linearElementEditor,
          )!,
        });
      } else {
        pointerDownState.lastCoords.x = pointerCoords.x;
        pointerDownState.lastCoords.y = pointerCoords.y;
        ctx.maybeDragNewGenericElement(pointerDownState, event, false);
      }
    }

    if (ctx.getState().activeTool.type === "selection") {
      pointerDownState.boxSelection.hasOccurred = true;

      const elements = ctx.scene.getNonDeletedElements();

      // box-select line editor points
      if (ctx.getState().selectedLinearElement?.isEditing) {
        ctx.linearElementEditor_handleBoxSelection(event);
        // regular box-select
      } else {
        let shouldReuseSelection = true;

        if (!event.shiftKey && isSomeElementSelected(elements, ctx.getState())) {
          if (
            pointerDownState.withCmdOrCtrl &&
            pointerDownState.hit.element
          ) {
            ctx.setState((prevState) =>
              selectGroupsForSelectedElements(
                {
                  ...prevState,
                  selectedElementIds: {
                    [pointerDownState.hit.element!.id]: true,
                  },
                },
                ctx.scene.getNonDeletedElements(),
                prevState,
                null,
              ),
            );
          } else {
            shouldReuseSelection = false;
          }
        }
        const elementsWithinSelection = ctx.getState().selectionElement
          ? getElementsWithinSelection(
              elements,
              ctx.getState().selectionElement!,
              ctx.scene.getNonDeletedElementsMap(),
              false,
              ctx.getState().boxSelectionMode,
            )
          : [];

        ctx.setState((prevState) => {
          const nextSelectedElementIds = {
            ...(shouldReuseSelection && prevState.selectedElementIds),
            ...elementsWithinSelection.reduce(
              (acc: Record<ExcalidrawElement["id"], true>, element) => {
                acc[element.id] = true;
                return acc;
              },
              {},
            ),
          };

          if (pointerDownState.hit.element) {
            // if using ctrl/cmd, select the hitElement only if we
            // haven't box-selected anything else
            if (!elementsWithinSelection.length) {
              nextSelectedElementIds[pointerDownState.hit.element.id] = true;
            } else {
              delete nextSelectedElementIds[pointerDownState.hit.element.id];
            }
          }

          prevState = !shouldReuseSelection
            ? { ...prevState, selectedGroupIds: {}, editingGroupId: null }
            : prevState;

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
            // select linear element only when we haven't box-selected anything else
            selectedLinearElement:
              elementsWithinSelection.length === 1 &&
              isLinearElement(elementsWithinSelection[0])
                ? new LinearElementEditor(
                    elementsWithinSelection[0],
                    ctx.scene.getNonDeletedElementsMap(),
                  )
                : null,
            showHyperlinkPopup:
              elementsWithinSelection.length === 1 &&
              (elementsWithinSelection[0].link ||
                isEmbeddableElement(elementsWithinSelection[0]))
                ? "info"
                : false,
          };
        });
      }
    }
  });
}
