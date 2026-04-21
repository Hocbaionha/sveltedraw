import type React from "react";

import {
  CURSOR_TYPE,
  EVENT,
  KEYS,
  MINIMUM_ARROW_SIZE,
  getFeatureFlag,
  getFontString,
  isShallowEqual,
  updateActiveTool,
  updateStable,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import {
  CaptureUpdateAction,
  LinearElementEditor,
  addElementsToFrame,
  bindOrUnbindBindingElements,
  elementOverlapsWithFrame,
  getContainingFrame,
  getElementsInGroup,
  getElementsInNewFrame,
  getElementsInResizingFrame,
  getMinTextElementWidth,
  getNormalizedDimensions,
  getSelectedElements,
  handleFocusPointPointerUp,
  hitElementBoundingBoxOnly,
  isArrowElement,
  isBindableElement,
  isElbowArrow,
  isElementInFrame,
  isEmbeddableElement,
  isFrameLikeElement,
  isInvisiblySmallElement,
  isLinearElement,
  isSelectedViaGroup,
  isSomeElementSelected,
  isTextElement,
  makeNextSelectedElementIds,
  newElementWith,
  removeElementsFromFrame,
  selectGroupsForSelectedElements,
} from "@excalidraw/element";

import type {
  ExcalidrawElbowArrowElement,
  ExcalidrawElement,
} from "@excalidraw/element/types";

import { pointDistance, pointFrom } from "@excalidraw/math";
import type { LocalPoint } from "@excalidraw/math";

import { isEraserActive } from "../appState";
import { actionFinalize, actionToggleLinearEditor } from "../actions";
import { resetCursor, setCursor } from "../cursor";
import { withBatchedUpdates } from "../reactUtils";
import { SnapCache } from "../snapping";
import type { PointerDownState } from "../types";

import type { AppEngineContext } from "./AppEngineContext";

export function onPointerUpFromPointerDownHandler(
  ctx: AppEngineContext,
  pointerDownState: PointerDownState,
): (event: PointerEvent) => void {
  return withBatchedUpdates((childEvent: PointerEvent) => {
    const elementsMap = ctx.scene.getNonDeletedElementsMap();

    ctx.removePointer(childEvent);
    pointerDownState.drag.blockDragging = false;
    if (pointerDownState.eventListeners.onMove) {
      pointerDownState.eventListeners.onMove.flush();
    }
    const {
      newElement,
      resizingElement,
      croppingElementId,
      multiElement,
      activeTool,
      isResizing,
      isRotating,
      isCropping,
    } = ctx.getState();

    ctx.setState((prevState) => ({
      isResizing: false,
      isRotating: false,
      isCropping: false,
      resizingElement: null,
      selectionElement: null,
      frameToHighlight: null,
      elementsToHighlight: null,
      cursorButton: "up",
      snapLines: updateStable(prevState.snapLines, []),
      originSnapOffset: null,
    }));

    // just in case, tool changes mid drag, always clean up
    ctx.lassoTrail.endPath();
    ctx.setPreviousPointerMoveCoords(null);

    SnapCache.setReferenceSnapPoints(null);
    SnapCache.setVisibleGaps(null);

    ctx.savePointer(childEvent.clientX, childEvent.clientY, "up");

    // if current elements are still selected
    // and the pointer is just over a locked element
    // do not allow activeLockedId to be set

    const hitElements = pointerDownState.hit.allHitElements;

    const sceneCoords = viewportCoordsToSceneCoords(
      { clientX: childEvent.clientX, clientY: childEvent.clientY },
      ctx.getState(),
    );

    if (
      ctx.getState().activeTool.type === "selection" &&
      !pointerDownState.boxSelection.hasOccurred &&
      !pointerDownState.resize.isResizing &&
      !hitElements.some((el) => ctx.getState().selectedElementIds[el.id])
    ) {
      const hitLockedElement = ctx.getElementAtPosition(
        sceneCoords.x,
        sceneCoords.y,
        {
          includeLockedElements: true,
        },
      );

      ctx.store.scheduleCapture();

      if (hitLockedElement?.locked) {
        ctx.setState({
          activeLockedId:
            hitLockedElement.groupIds.length > 0
              ? hitLockedElement.groupIds.at(-1) || ""
              : hitLockedElement.id,
        });
      } else {
        ctx.setState({
          activeLockedId: null,
        });
      }
    } else {
      ctx.setState({
        activeLockedId: null,
      });
    }

    if (getFeatureFlag("COMPLEX_BINDINGS")) {
      ctx.resetDelayedBindMode();
    }

    ctx.setState({
      selectedElementsAreBeingDragged: false,
      bindMode: "orbit",
    });

    if (
      pointerDownState.drag.hasOccurred &&
      pointerDownState.hit?.element?.id
    ) {
      const element = elementsMap.get(pointerDownState.hit.element.id);
      if (isBindableElement(element)) {
        // Renormalize elbow arrows when they are changed via indirect move
        element.boundElements
          ?.filter((e) => e.type === "arrow")
          .map((e) => elementsMap.get(e.id))
          .filter((e) => isElbowArrow(e))
          .forEach((e) => {
            !!e && ctx.scene.mutateElement(e, {});
          });
      }
    }

    // Handle end of dragging a point of a linear element, might close a loop
    // and sets binding element
    if (
      ctx.getState().selectedLinearElement?.isEditing &&
      !ctx.getState().newElement &&
      ctx.getState().selectedLinearElement!.draggedFocusPointBinding === null
    ) {
      if (
        !pointerDownState.boxSelection.hasOccurred &&
        pointerDownState.hit?.element?.id !==
          ctx.getState().selectedLinearElement!.elementId &&
        ctx.getState().selectedLinearElement!.draggedFocusPointBinding === null
      ) {
        ctx.actionManager.executeAction(actionFinalize);
      } else {
        const editingLinearElement = LinearElementEditor.handlePointerUp(
          childEvent,
          ctx.getState().selectedLinearElement!,
          ctx.getState(),
          ctx.scene,
        );
        ctx.actionManager.executeAction(actionFinalize, "ui", {
          event: childEvent,
          sceneCoords,
        });
        if (editingLinearElement !== ctx.getState().selectedLinearElement) {
          ctx.setState({
            selectedLinearElement: editingLinearElement,
            suggestedBinding: null,
          });
        }
      }
    } else if (ctx.getState().selectedLinearElement) {
      // Normalize elbow arrow points, remove close parallel segments
      if (ctx.getState().selectedLinearElement!.elbowed) {
        const element = LinearElementEditor.getElement(
          ctx.getState().selectedLinearElement!.elementId,
          ctx.scene.getNonDeletedElementsMap(),
        );
        if (element) {
          ctx.scene.mutateElement(element as ExcalidrawElbowArrowElement, {});
        }
      }

      if (ctx.getState().selectedLinearElement!.draggedFocusPointBinding) {
        handleFocusPointPointerUp(
          ctx.getState().selectedLinearElement!,
          ctx.scene,
        );
        ctx.setState({
          selectedLinearElement: {
            ...ctx.getState().selectedLinearElement!,
            draggedFocusPointBinding: null,
          },
        });
      } else if (
        pointerDownState.hit?.element?.id !==
        ctx.getState().selectedLinearElement!.elementId
      ) {
        const selectedELements = ctx.scene.getSelectedElements(ctx.getState());
        // set selectedLinearElement to null if there is more than one element selected since we don't want to show linear element handles
        if (selectedELements.length > 1) {
          ctx.setState({ selectedLinearElement: null });
        }
      } else if (ctx.getState().selectedLinearElement!.isDragging) {
        ctx.setState({
          selectedLinearElement: {
            ...ctx.getState().selectedLinearElement!,
            isDragging: false,
          },
        });
        ctx.actionManager.executeAction(actionFinalize, "ui", {
          event: childEvent,
          sceneCoords,
        });
      }

      if (
        ctx.getState().newElement &&
        ctx.getState().multiElement &&
        isLinearElement(ctx.getState().newElement) &&
        ctx.getState().selectedLinearElement
      ) {
        const { multiElement: me } = ctx.getState();

        ctx.setState({
          selectedLinearElement: {
            ...ctx.getState().selectedLinearElement!,
            lastCommittedPoint: me!.points[me!.points.length - 1],
          },
        });
      }
    }

    ctx.missingPointerEventCleanupEmitter_clear();

    window.removeEventListener(
      EVENT.POINTER_MOVE,
      pointerDownState.eventListeners.onMove!,
    );
    window.removeEventListener(
      EVENT.POINTER_UP,
      pointerDownState.eventListeners.onUp!,
    );
    window.removeEventListener(
      EVENT.KEYDOWN,
      pointerDownState.eventListeners.onKeyDown!,
    );
    window.removeEventListener(
      EVENT.KEYUP,
      pointerDownState.eventListeners.onKeyUp!,
    );

    ctx.propOnPointerUp?.(activeTool, pointerDownState);
    ctx.onPointerUpEmitter_trigger(
      ctx.getState().activeTool,
      pointerDownState,
      childEvent,
    );

    if (newElement?.type === "freedraw") {
      const pointerCoords = viewportCoordsToSceneCoords(
        childEvent,
        ctx.getState(),
      );

      const points = newElement.points;
      let dx = pointerCoords.x - newElement.x;
      let dy = pointerCoords.y - newElement.y;

      // Allows dots to avoid being flagged as infinitely small
      if (dx === points[0][0] && dy === points[0][1]) {
        dy += 0.0001;
        dx += 0.0001;
      }

      const pressures = newElement.simulatePressure
        ? []
        : [...newElement.pressures, childEvent.pressure];

      ctx.scene.mutateElement(newElement, {
        points: [...points, pointFrom<LocalPoint>(dx, dy)],
        pressures,
      });

      ctx.actionManager.executeAction(actionFinalize);

      return;
    }

    if (isLinearElement(newElement)) {
      if (
        newElement!.points.length > 1 &&
        newElement.points[1][0] !== 0 &&
        newElement.points[1][1] !== 0
      ) {
        ctx.store.scheduleCapture();
      }
      const pointerCoords = viewportCoordsToSceneCoords(
        childEvent,
        ctx.getState(),
      );

      const dragDistance =
        pointDistance(
          pointFrom(pointerCoords.x, pointerCoords.y),
          pointFrom(pointerDownState.origin.x, pointerDownState.origin.y),
        ) * ctx.getState().zoom.value;

      if (
        (!pointerDownState.drag.hasOccurred ||
          dragDistance < MINIMUM_ARROW_SIZE) &&
        newElement &&
        !multiElement
      ) {
        if (ctx.editorInterface.isTouchScreen) {
          const FIXED_DELTA_X = Math.min(
            (ctx.getState().width * 0.7) / ctx.getState().zoom.value,
            100,
          );

          ctx.scene.mutateElement(
            newElement,
            {
              x: newElement.x - FIXED_DELTA_X / 2,
              points: [
                pointFrom<LocalPoint>(0, 0),
                pointFrom<LocalPoint>(FIXED_DELTA_X, 0),
              ],
            },
            { informMutation: false, isDragging: false },
          );

          ctx.actionManager.executeAction(actionFinalize);
        } else {
          const dx = pointerCoords.x - newElement.x;
          const dy = pointerCoords.y - newElement.y;

          ctx.scene.mutateElement(
            newElement,
            {
              points: [newElement.points[0], pointFrom<LocalPoint>(dx, dy)],
            },
            { informMutation: false, isDragging: false },
          );

          ctx.setState({
            multiElement: newElement,
            newElement,
          });
        }
      } else if (pointerDownState.drag.hasOccurred && !multiElement) {
        if (isLinearElement(newElement)) {
          ctx.actionManager.executeAction(actionFinalize, "ui", {
            event: childEvent,
            sceneCoords,
          });
        }
        ctx.setState({ suggestedBinding: null, startBoundElement: null });
        if (!activeTool.locked) {
          resetCursor(ctx.interactiveCanvas);
          ctx.setState((prevState) => ({
            newElement: null,
            activeTool: updateActiveTool(ctx.getState(), {
              type: ctx.getState().preferredSelectionTool.type,
            }),
            selectedElementIds: makeNextSelectedElementIds(
              {
                ...prevState.selectedElementIds,
                [newElement.id]: true,
              },
              prevState,
            ),
            selectedLinearElement: new LinearElementEditor(
              newElement,
              ctx.scene.getNonDeletedElementsMap(),
            ),
          }));
        } else {
          ctx.setState(() => ({
            newElement: null,
          }));
        }
        // so that the scene gets rendered again to display the newly drawn linear as well
        ctx.scene.triggerUpdate();
      }
      return;
    }

    if (isTextElement(newElement)) {
      const minWidth = getMinTextElementWidth(
        getFontString({
          fontSize: newElement.fontSize,
          fontFamily: newElement.fontFamily,
        }),
        newElement.lineHeight,
      );

      if (newElement.width < minWidth) {
        ctx.scene.mutateElement(newElement, {
          autoResize: true,
        });
      }

      ctx.appResetCursor();

      ctx.handleTextWysiwyg(newElement, {
        isExistingElement: true,
      });
    }

    if (
      activeTool.type !== "selection" &&
      newElement &&
      isInvisiblySmallElement(newElement)
    ) {
      // remove invisible element which was added in onPointerDown
      // update the store snapshot, so that invisible elements are not captured by the store
      ctx.updateScene({
        elements: ctx.scene
          .getElementsIncludingDeleted()
          .filter((el) => el.id !== newElement.id),
        appState: {
          newElement: null,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      return;
    }

    if (isFrameLikeElement(newElement)) {
      const elementsInsideFrame = getElementsInNewFrame(
        ctx.scene.getElementsIncludingDeleted(),
        newElement,
        ctx.scene.getNonDeletedElementsMap(),
      );

      ctx.scene.replaceAllElements(
        addElementsToFrame(
          ctx.scene.getElementsMapIncludingDeleted(),
          elementsInsideFrame,
          newElement,
          ctx.getState(),
        ),
      );
    }

    if (newElement) {
      ctx.scene.mutateElement(newElement, getNormalizedDimensions(newElement), {
        informMutation: false,
        isDragging: false,
      });
      // the above does not guarantee the scene to be rendered again, hence the trigger below
      ctx.scene.triggerUpdate();
    }

    if (pointerDownState.drag.hasOccurred) {
      const sceneCoords2 = viewportCoordsToSceneCoords(
        childEvent,
        ctx.getState(),
      );

      // when editing the points of a linear element, we check if the
      // linear element still is in the frame afterwards
      // if not, the linear element will be removed from its frame (if any)
      if (
        ctx.getState().selectedLinearElement &&
        ctx.getState().selectedLinearElement!.isDragging
      ) {
        const linearElement = ctx.scene.getElement(
          ctx.getState().selectedLinearElement!.elementId,
        );

        if (linearElement?.frameId) {
          const frame = getContainingFrame(linearElement, elementsMap);

          if (frame && linearElement) {
            if (
              !elementOverlapsWithFrame(
                linearElement,
                frame,
                ctx.scene.getNonDeletedElementsMap(),
              )
            ) {
              // remove the linear element from all groups
              // before removing it from the frame as well
              ctx.scene.mutateElement(linearElement, {
                groupIds: [],
              });

              removeElementsFromFrame(
                [linearElement],
                ctx.scene.getNonDeletedElementsMap(),
              );

              ctx.scene.triggerUpdate();
            }
          }
        }
      } else {
        // update the relationships between selected elements and frames
        const topLayerFrame = ctx.getTopLayerFrameAtSceneCoords(sceneCoords2);

        const selectedElements = ctx.scene.getSelectedElements(ctx.getState());
        let nextElements = ctx.scene.getElementsMapIncludingDeleted();

        const updateGroupIdsAfterEditingGroup = (
          elements: ExcalidrawElement[],
        ) => {
          if (elements.length > 0) {
            for (const element of elements) {
              const index = element.groupIds.indexOf(
                ctx.getState().editingGroupId!,
              );

              ctx.scene.mutateElement(
                element,
                {
                  groupIds: element.groupIds.slice(0, index),
                },
                { informMutation: false, isDragging: false },
              );
            }

            nextElements.forEach((element) => {
              if (
                element.groupIds.length &&
                getElementsInGroup(
                  nextElements,
                  element.groupIds[element.groupIds.length - 1],
                ).length < 2
              ) {
                ctx.scene.mutateElement(
                  element,
                  {
                    groupIds: [],
                  },
                  { informMutation: false, isDragging: false },
                );
              }
            });

            ctx.setState({
              editingGroupId: null,
            });
          }
        };

        if (
          topLayerFrame &&
          !ctx.getState().selectedElementIds[topLayerFrame.id]
        ) {
          const elementsToAdd = selectedElements.filter(
            (element) =>
              element.frameId !== topLayerFrame.id &&
              isElementInFrame(element, nextElements, ctx.getState()),
          );

          if (ctx.getState().editingGroupId) {
            updateGroupIdsAfterEditingGroup(elementsToAdd);
          }

          nextElements = addElementsToFrame(
            nextElements,
            elementsToAdd,
            topLayerFrame,
            ctx.getState(),
          );
        } else if (!topLayerFrame) {
          if (ctx.getState().editingGroupId) {
            const elementsToRemove = selectedElements.filter(
              (element) =>
                element.frameId &&
                !isElementInFrame(element, nextElements, ctx.getState()),
            );

            updateGroupIdsAfterEditingGroup(elementsToRemove);
          }
        }

        nextElements =
          ctx.updateFrameMembershipOfSelectedElements_facade(nextElements);

        ctx.scene.replaceAllElements(nextElements);
      }
    }

    if (resizingElement) {
      ctx.store.scheduleCapture();
    }

    if (resizingElement && isInvisiblySmallElement(resizingElement)) {
      // update the store snapshot, so that invisible elements are not captured by the store
      ctx.updateScene({
        elements: ctx.scene
          .getElementsIncludingDeleted()
          .filter((el) => el.id !== resizingElement.id),
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }

    // handle frame membership for resizing frames and/or selected elements
    if (pointerDownState.resize.isResizing) {
      let nextElements = ctx.updateFrameMembershipOfSelectedElements_facade(
        ctx.scene.getElementsIncludingDeleted(),
      );

      const selectedFrames = ctx.scene
        .getSelectedElements(ctx.getState())
        .filter(isFrameLikeElement);

      for (const frame of selectedFrames) {
        nextElements = ctx.replaceAllElementsInFrame_facade(
          nextElements,
          getElementsInResizingFrame(
            ctx.scene.getElementsIncludingDeleted(),
            frame,
            ctx.getState(),
            elementsMap,
          ),
          frame,
        );
      }

      ctx.scene.replaceAllElements(nextElements);
    }

    // Code below handles selection when element(s) weren't
    // drag or added to selection on pointer down phase.
    const hitElement = pointerDownState.hit.element;
    if (
      ctx.getState().selectedLinearElement?.elementId !== hitElement?.id &&
      isLinearElement(hitElement)
    ) {
      const selectedElements = ctx.scene.getSelectedElements(ctx.getState());
      // set selectedLinearElement when no other element selected except
      // the one we've hit
      if (selectedElements.length === 1) {
        ctx.setState({
          selectedLinearElement: new LinearElementEditor(
            hitElement,
            ctx.scene.getNonDeletedElementsMap(),
          ),
        });
      }
    }

    // click outside the cropping region to exit
    if (
      // not in the cropping mode at all
      !croppingElementId ||
      // in the cropping mode
      (croppingElementId &&
        // not cropping and no hit element
        ((!hitElement && !isCropping) ||
          // hitting something else
          (hitElement && hitElement.id !== croppingElementId)))
    ) {
      ctx.finishImageCropping();
    }

    const pointerStart = ctx.getLastPointerDownEvent();
    const pointerEnd = ctx.getLastPointerUpEvent() || ctx.getLastPointerMoveEvent();

    if (isEraserActive(ctx.getState()) && pointerStart && pointerEnd) {
      ctx.eraserTrail.endPath();

      const draggedDistance = pointDistance(
        pointFrom(pointerStart.clientX, pointerStart.clientY),
        pointFrom(pointerEnd.clientX, pointerEnd.clientY),
      );

      if (draggedDistance === 0) {
        const scenePointer = viewportCoordsToSceneCoords(
          {
            clientX: pointerEnd.clientX,
            clientY: pointerEnd.clientY,
          },
          ctx.getState(),
        );
        const hitElementsErase = ctx.getElementsAtPosition(
          scenePointer.x,
          scenePointer.y,
        );
        hitElementsErase.forEach((hitEl) =>
          ctx.getElementsPendingErasure().add(hitEl.id),
        );
      }
      ctx.eraseElements();
      return;
    } else if (ctx.getElementsPendingErasure().size) {
      ctx.restoreReadyToEraseElements();
    }

    if (
      hitElement &&
      !pointerDownState.drag.hasOccurred &&
      !pointerDownState.hit.wasAddedToSelection &&
      // if we're editing a line, pointerup shouldn't switch selection if
      // box selected
      (!ctx.getState().selectedLinearElement?.isEditing ||
        !pointerDownState.boxSelection.hasOccurred) &&
      // hitElement can be set when alt + ctrl to toggle lasso and we will
      // just respect the selected elements from lasso instead
      ctx.getState().activeTool.type !== "lasso"
    ) {
      // when inside line editor, shift selects points instead
      if (
        childEvent.shiftKey &&
        !ctx.getState().selectedLinearElement?.isEditing
      ) {
        if (ctx.getState().selectedElementIds[hitElement.id]) {
          if (isSelectedViaGroup(ctx.getState(), hitElement)) {
            ctx.setState((_prevState) => {
              const nextSelectedElementIds = {
                ..._prevState.selectedElementIds,
              };

              // We want to unselect all groups hitElement is part of
              // as well as all elements that are part of the groups
              // hitElement is part of
              for (const groupedElement of hitElement.groupIds.flatMap(
                (groupId) =>
                  getElementsInGroup(
                    ctx.scene.getNonDeletedElements(),
                    groupId,
                  ),
              )) {
                delete nextSelectedElementIds[groupedElement.id];
              }

              return {
                selectedGroupIds: {
                  ..._prevState.selectedElementIds,
                  ...hitElement.groupIds
                    .map((gId) => ({ [gId]: false }))
                    .reduce((prev, acc) => ({ ...prev, ...acc }), {}),
                },
                selectedElementIds: makeNextSelectedElementIds(
                  nextSelectedElementIds,
                  _prevState,
                ),
              };
            });
            // if not dragging a linear element point (outside editor)
          } else if (!ctx.getState().selectedLinearElement?.isDragging) {
            // remove element from selection while
            // keeping prev elements selected

            ctx.setState((prevState) => {
              const newSelectedElementIds = {
                ...prevState.selectedElementIds,
              };
              delete newSelectedElementIds[hitElement!.id];
              const newSelectedElements = getSelectedElements(
                ctx.scene.getNonDeletedElements(),
                { selectedElementIds: newSelectedElementIds },
              );

              return {
                ...selectGroupsForSelectedElements(
                  {
                    editingGroupId: prevState.editingGroupId,
                    selectedElementIds: newSelectedElementIds,
                  },
                  ctx.scene.getNonDeletedElements(),
                  prevState,
                  null,
                ),
                // set selectedLinearElement only if thats the only element selected
                selectedLinearElement:
                  newSelectedElements.length === 1 &&
                  isLinearElement(newSelectedElements[0])
                    ? new LinearElementEditor(
                        newSelectedElements[0],
                        ctx.scene.getNonDeletedElementsMap(),
                      )
                    : prevState.selectedLinearElement,
              };
            });
          }
        } else if (
          hitElement.frameId &&
          ctx.getState().selectedElementIds[hitElement.frameId]
        ) {
          // when hitElement is part of a selected frame, deselect the frame
          // to avoid frame and containing elements selected simultaneously
          ctx.setState((prevState) => {
            const nextSelectedElementIds: {
              [id: string]: true;
            } = {
              ...prevState.selectedElementIds,
              [hitElement.id]: true,
            };
            // deselect the frame
            delete nextSelectedElementIds[hitElement.frameId!];

            // deselect groups containing the frame
            (ctx.scene.getElement(hitElement.frameId!)?.groupIds ?? [])
              .flatMap((gid) =>
                getElementsInGroup(ctx.scene.getNonDeletedElements(), gid),
              )
              .forEach((element) => {
                delete nextSelectedElementIds[element.id];
              });

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
        } else {
          // add element to selection while keeping prev elements selected
          ctx.setState((_prevState) => ({
            selectedElementIds: makeNextSelectedElementIds(
              {
                ..._prevState.selectedElementIds,
                [hitElement!.id]: true,
              },
              _prevState,
            ),
          }));
        }
      } else {
        ctx.setState((prevState) => ({
          ...selectGroupsForSelectedElements(
            {
              editingGroupId: prevState.editingGroupId,
              selectedElementIds: { [hitElement.id]: true },
            },
            ctx.scene.getNonDeletedElements(),
            prevState,
            null,
          ),
          selectedLinearElement:
            isLinearElement(hitElement) &&
            // Don't set `selectedLinearElement` if its same as the hitElement, this is mainly to prevent resetting the `hoverPointIndex` to -1.
            // Future we should update the API to take care of setting the correct `hoverPointIndex` when initialized
            prevState.selectedLinearElement?.elementId !== hitElement.id
              ? new LinearElementEditor(
                  hitElement,
                  ctx.scene.getNonDeletedElementsMap(),
                )
              : prevState.selectedLinearElement,
        }));
      }
    }

    if (
      // do not clear selection if lasso is active
      ctx.getState().activeTool.type !== "lasso" &&
      // not elbow midpoint dragged
      !(hitElement && isElbowArrow(hitElement)) &&
      // not dragged
      !pointerDownState.drag.hasOccurred &&
      // not resized
      !ctx.getState().isResizing &&
      // only hitting the bounding box of the previous hit element
      ((hitElement &&
        hitElementBoundingBoxOnly(
          {
            point: pointFrom(
              pointerDownState.origin.x,
              pointerDownState.origin.y,
            ),
            element: hitElement,
            elementsMap,
            threshold: ctx.getElementHitThreshold(hitElement),
            frameNameBound: isFrameLikeElement(hitElement)
              ? ctx.frameNameBoundsCache.get(hitElement)
              : null,
          },
          elementsMap,
        )) ||
        (!hitElement &&
          pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements))
    ) {
      if (ctx.getState().selectedLinearElement?.isEditing) {
        // Exit editing mode but keep the element selected
        ctx.actionManager.executeAction(actionToggleLinearEditor);
      } else {
        // Deselect selected elements
        ctx.setState({
          selectedElementIds: makeNextSelectedElementIds({}, ctx.getState()),
          selectedGroupIds: {},
          editingGroupId: null,
          activeEmbeddable: null,
        });
      }
      // reset cursor
      setCursor(ctx.interactiveCanvas, CURSOR_TYPE.AUTO);
      return;
    }

    const selectedTextEditingContainer =
      ctx.getSelectedTextEditingContainerAtPosition(hitElement, sceneCoords);

    if (
      activeTool.type === ctx.getState().preferredSelectionTool.type &&
      !ctx.getState().editingTextElement &&
      !pointerDownState.drag.hasOccurred &&
      !pointerDownState.hit.wasAddedToSelection &&
      !childEvent.shiftKey &&
      !childEvent[KEYS.CTRL_OR_CMD] &&
      !childEvent.altKey &&
      childEvent.pointerType !== "touch" &&
      hitElement &&
      ((isTextElement(hitElement) &&
        ctx.getState().selectedElementIds[hitElement.id] &&
        ctx.scene.getSelectedElements(ctx.getState()).length === 1) ||
        selectedTextEditingContainer)
    ) {
      ctx.startTextEditing({
        sceneX: sceneCoords.x,
        sceneY: sceneCoords.y,
        container: selectedTextEditingContainer,
        initialCaretSceneCoords: ctx.getLastPointerUpIsDoubleClick()
          ? undefined
          : sceneCoords,
      });
      return;
    }

    if (!activeTool.locked && activeTool.type !== "freedraw" && newElement) {
      ctx.setState((prevState) => ({
        selectedElementIds: makeNextSelectedElementIds(
          {
            ...prevState.selectedElementIds,
            [newElement.id]: true,
          },
          prevState,
        ),
        showHyperlinkPopup:
          isEmbeddableElement(newElement) && !newElement.link
            ? "editor"
            : prevState.showHyperlinkPopup,
      }));
    }

    if (
      activeTool.type !== "selection" ||
      isSomeElementSelected(ctx.scene.getNonDeletedElements(), ctx.getState()) ||
      !isShallowEqual(
        ctx.getState().previousSelectedElementIds,
        ctx.getState().selectedElementIds,
      )
    ) {
      ctx.store.scheduleCapture();
    }

    if (
      (pointerDownState.drag.hasOccurred &&
        !ctx.getState().selectedLinearElement) ||
      isResizing ||
      isRotating ||
      isCropping
    ) {
      // We only allow binding via linear elements, specifically via dragging
      // the endpoints ("start" or "end").
      const linearElements = ctx.scene
        .getSelectedElements(ctx.getState())
        .filter(isArrowElement);

      bindOrUnbindBindingElements(linearElements, ctx.scene, ctx.getState());
    }

    if (activeTool.type === "laser") {
      ctx.laserTrails.endPath();
      return;
    }

    if (
      !activeTool.locked &&
      activeTool.type !== "freedraw" &&
      (activeTool.type !== "lasso" ||
        // if lasso is turned on but from selection => reset to selection
        (activeTool.type === "lasso" && activeTool.fromSelection))
    ) {
      resetCursor(ctx.interactiveCanvas);
      ctx.setState({
        newElement: null,
        suggestedBinding: null,
        activeTool: updateActiveTool(ctx.getState(), {
          type: ctx.getState().preferredSelectionTool.type,
        }),
      });
    } else {
      ctx.setState({
        newElement: null,
        suggestedBinding: null,
      });
    }
  });
}
