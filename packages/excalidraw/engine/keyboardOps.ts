/**
 * keyboardOps — onKeyDown and onKeyUp extracted from App.tsx.
 *
 * Delegated in App.tsx: onKeyDown, onKeyUp.
 */

import React from "react";
import { flushSync } from "react-dom";

import {
  CLASSES,
  CODES,
  KEYS,
  CURSOR_TYPE,
  ARROW_TYPE,
  ELEMENT_TRANSLATE_AMOUNT,
  ELEMENT_SHIFT_TRANSLATE_AMOUNT,
  isArrowKey,
  isInputLike,
  isWritableElement,
  isSelectionLikeTool,
  oneOf,
  getFeatureFlag,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import {
  isImageElement,
  isFlowchartNodeElement,
  getLinkDirectionFromKey,
  isElementCompletelyInViewport,
  makeNextSelectedElementIds,
  isTextElement,
  isValidTextContainer,
  isLineElement,
  isLinearElement,
  isElbowArrow,
  isFrameLikeElement,
  isArrowElement,
  isBindingElement,
  isSimpleArrow,
  calculateFixedPointForNonElbowArrowBinding,
  bindOrUnbindBindingElements,
  updateBoundElements,
  LinearElementEditor,
  isBindingEnabled,
  CaptureUpdateAction,
  getBoundTextElement,
  getContainerCenter,
  getHoveredElementForBinding,
} from "@excalidraw/element";

import type {
  ExcalidrawTextContainer,
  ExcalidrawBindableElement,
  ExcalidrawArrowElement,
  NonDeletedExcalidrawElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { pointFrom } from "@excalidraw/math";
import type { GlobalPoint } from "@excalidraw/math";

import { t } from "../i18n";
import { trackEvent } from "../analytics";
import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { setCursor, resetCursor, setCursorForShape } from "../cursor";
import { editorJotaiStore } from "../editor-jotai";

import {
  convertElementTypePopupAtom,
  getConversionTypeFromElements,
} from "../components/ConvertElementTypePopup";
import { activeConfirmDialogAtom } from "../components/ActiveConfirmDialog";
import { actionToggleLinearEditor } from "../actions";

import { getSelectedElements, hasBackground } from "../scene";

import { translateCanvas } from "./scrollOps";

import type { AppEngineContext } from "./AppEngineContext";

// ---------------------------------------------------------------------------
// 1. onKeyDown
// ---------------------------------------------------------------------------

export function onKeyDown(
  ctx: AppEngineContext,
  origEvent: React.KeyboardEvent | KeyboardEvent,
): void {
  // normalize `event.key` when CapsLock is pressed #2372
  let event: React.KeyboardEvent | KeyboardEvent = origEvent;

  if (
    "Proxy" in window &&
    ((!origEvent.shiftKey && /^[A-Z]$/.test(origEvent.key)) ||
      (origEvent.shiftKey && /^[a-z]$/.test(origEvent.key)))
  ) {
    event = new Proxy(origEvent, {
      get(ev: any, prop) {
        const value = ev[prop];
        if (typeof value === "function") {
          // fix for Proxies hijacking `this`
          return value.bind(ev);
        }
        return prop === "key"
          ? // CapsLock inverts capitalization based on ShiftKey, so invert it back
            origEvent.shiftKey
            ? ev.key.toUpperCase()
            : ev.key.toLowerCase()
          : value;
      },
    });
  }

  if (!isInputLike(event.target)) {
    if (
      (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) &&
      ctx.getState().croppingElementId
    ) {
      ctx.finishImageCropping();
      return;
    }

    const selectedElements = getSelectedElements(
      ctx.scene.getNonDeletedElementsMap(),
      ctx.getState(),
    );

    if (
      selectedElements.length === 1 &&
      isImageElement(selectedElements[0]) &&
      event.key === KEYS.ENTER
    ) {
      ctx.startImageCropping(selectedElements[0]);
      return;
    }

    // Shape switching
    if (event.key === KEYS.ESCAPE) {
      ctx.updateEditorAtom(convertElementTypePopupAtom, null);
    } else if (
      event.key === KEYS.TAB &&
      (document.activeElement === ctx.excalidrawContainerRef?.current ||
        document.activeElement?.classList.contains(
          CLASSES.CONVERT_ELEMENT_TYPE_POPUP,
        ))
    ) {
      event.preventDefault();

      const conversionType = getConversionTypeFromElements(selectedElements);

      if (
        editorJotaiStore.get(convertElementTypePopupAtom)?.type === "panel"
      ) {
        if (
          ctx.convertElementTypes({
            conversionType,
            direction: event.shiftKey ? "left" : "right",
          })
        ) {
          ctx.store.scheduleCapture();
        }
      }
      if (conversionType) {
        ctx.updateEditorAtom(convertElementTypePopupAtom, {
          type: "panel",
        });
      }
    }

    if (
      event.key === KEYS.ESCAPE &&
      ctx.flowChartCreator.isCreatingChart
    ) {
      ctx.flowChartCreator.clear();
      ctx.triggerRender(true);
      return;
    }

    const arrowKeyPressed = isArrowKey(event.key);

    if (event[KEYS.CTRL_OR_CMD] && arrowKeyPressed && !event.shiftKey) {
      event.preventDefault();

      const selectedElements2 = getSelectedElements(
        ctx.scene.getNonDeletedElementsMap(),
        ctx.getState(),
      );

      if (
        selectedElements2.length === 1 &&
        isFlowchartNodeElement(selectedElements2[0])
      ) {
        ctx.flowChartCreator.createNodes(
          selectedElements2[0],
          ctx.getState(),
          getLinkDirectionFromKey(event.key),
          ctx.scene,
        );
      }

      if (
        ctx.flowChartCreator.pendingNodes?.length &&
        !isElementCompletelyInViewport(
          ctx.flowChartCreator.pendingNodes,
          ctx.canvas!.width / window.devicePixelRatio,
          ctx.canvas!.height / window.devicePixelRatio,
          {
            offsetLeft: ctx.getState().offsetLeft,
            offsetTop: ctx.getState().offsetTop,
            scrollX: ctx.getState().scrollX,
            scrollY: ctx.getState().scrollY,
            zoom: ctx.getState().zoom,
          },
          ctx.scene.getNonDeletedElementsMap(),
          ctx.getEditorUIOffsets(),
        )
      ) {
        ctx.scrollToContent(ctx.flowChartCreator.pendingNodes, {
          animate: true,
          duration: 300,
          fitToContent: true,
          canvasOffsets: ctx.getEditorUIOffsets(),
        });
      }

      return;
    }

    if (event.altKey) {
      const selectedElements3 = getSelectedElements(
        ctx.scene.getNonDeletedElementsMap(),
        ctx.getState(),
      );

      if (selectedElements3.length === 1 && arrowKeyPressed) {
        event.preventDefault();

        const nextId = ctx.flowChartNavigator.exploreByDirection(
          selectedElements3[0],
          ctx.scene.getNonDeletedElementsMap(),
          getLinkDirectionFromKey(event.key),
        );

        if (nextId) {
          ctx.setState((prevState) => ({
            selectedElementIds: makeNextSelectedElementIds(
              {
                [nextId]: true,
              },
              prevState,
            ),
          }));

          const nextNode = ctx.scene
            .getNonDeletedElementsMap()
            .get(nextId);

          if (
            nextNode &&
            !isElementCompletelyInViewport(
              [nextNode],
              ctx.canvas!.width / window.devicePixelRatio,
              ctx.canvas!.height / window.devicePixelRatio,
              {
                offsetLeft: ctx.getState().offsetLeft,
                offsetTop: ctx.getState().offsetTop,
                scrollX: ctx.getState().scrollX,
                scrollY: ctx.getState().scrollY,
                zoom: ctx.getState().zoom,
              },
              ctx.scene.getNonDeletedElementsMap(),
              ctx.getEditorUIOffsets(),
            )
          ) {
            ctx.scrollToContent(nextNode, {
              animate: true,
              duration: 300,
              canvasOffsets: ctx.getEditorUIOffsets(),
            });
          }
        }
        return;
      }
    }
  }

  if (
    event[KEYS.CTRL_OR_CMD] &&
    event.key === KEYS.P &&
    !event.shiftKey &&
    !event.altKey
  ) {
    ctx.setToast({
      message: t("commandPalette.shortcutHint", {
        shortcut: getShortcutFromShortcutName("commandPalette"),
      }),
    });
    event.preventDefault();
    return;
  }

  if (event[KEYS.CTRL_OR_CMD] && event.key.toLowerCase() === KEYS.V) {
    ctx.setIsPlainPaste(event.shiftKey);
    clearTimeout(ctx.getIsPlainPasteTimer());
    // reset (100ms to be safe that we it runs after the ensuing
    // paste event). Though, technically unnecessary to reset since we
    // (re)set the flag before each paste event.
    ctx.setIsPlainPasteTimer(
      window.setTimeout(() => {
        ctx.setIsPlainPaste(false);
      }, 100),
    );
  }

  // prevent browser zoom in input fields
  if (event[KEYS.CTRL_OR_CMD] && isWritableElement(event.target)) {
    if (event.code === CODES.MINUS || event.code === CODES.EQUAL) {
      event.preventDefault();
      return;
    }
  }

  // bail if
  if (
    // inside an input
    (isWritableElement(event.target) &&
      // unless pressing escape (finalize action)
      event.key !== KEYS.ESCAPE) ||
    // or unless using arrows (to move between buttons)
    (isArrowKey(event.key) && isInputLike(event.target))
  ) {
    return;
  }

  if (event.key === KEYS.QUESTION_MARK) {
    ctx.setState({
      openDialog: { name: "help" },
    });
    return;
  } else if (
    event.key.toLowerCase() === KEYS.E &&
    event.shiftKey &&
    event[KEYS.CTRL_OR_CMD]
  ) {
    event.preventDefault();
    ctx.setState({ openDialog: { name: "imageExport" } });
    return;
  }

  if (event.key === KEYS.PAGE_UP || event.key === KEYS.PAGE_DOWN) {
    const state = ctx.getState();
    let offset =
      (event.shiftKey ? state.width : state.height) / state.zoom.value;
    if (event.key === KEYS.PAGE_DOWN) {
      offset = -offset;
    }
    if (event.shiftKey) {
      translateCanvas(ctx, (s) => ({
        scrollX: s.scrollX + offset,
      }));
    } else {
      translateCanvas(ctx, (s) => ({
        scrollY: s.scrollY + offset,
      }));
    }
  }

  if (ctx.getState().openDialog?.name === "elementLinkSelector") {
    return;
  }

  // Handle Alt key for bind mode
  if (event.key === KEYS.ALT) {
    if (getFeatureFlag("COMPLEX_BINDINGS")) {
      ctx.handleSkipBindMode();
    } else {
      ctx.maybeHandleArrowPointlikeDrag(event);
    }
  }

  if (ctx.actionManager.handleKeyDown(event)) {
    return;
  }

  // view mode hardcoded from upstream -> disable tool switching for now
  const shouldPreventToolSwitching = ctx.propViewModeEnabled === true;

  if (
    !shouldPreventToolSwitching &&
    ctx.getState().viewModeEnabled &&
    event.key === KEYS.ESCAPE
  ) {
    ctx.setActiveTool({ type: "selection" });
    return;
  }

  if (
    !shouldPreventToolSwitching &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !ctx.getState().newElement &&
    !ctx.getState().selectionElement &&
    !ctx.getState().selectedElementsAreBeingDragged
  ) {
    const shape = ctx.findShapeByKey(event.key);

    if (ctx.getState().viewModeEnabled && !oneOf(shape, ["laser", "hand"])) {
      return;
    }

    if (shape) {
      if (ctx.getState().activeTool.type !== shape) {
        trackEvent(
          "toolbar",
          shape,
          `keyboard (${
            ctx.editorInterface.formFactor === "phone" ? "mobile" : "desktop"
          })`,
        );
      }
      if (shape === "arrow" && ctx.getState().activeTool.type === "arrow") {
        ctx.setState((prevState) => ({
          currentItemArrowType:
            prevState.currentItemArrowType === ARROW_TYPE.sharp
              ? ARROW_TYPE.round
              : prevState.currentItemArrowType === ARROW_TYPE.round
              ? ARROW_TYPE.elbow
              : ARROW_TYPE.sharp,
        }));
      }

      if (shape === "lasso" && ctx.getState().activeTool.type === "laser") {
        ctx.setActiveTool({
          type: ctx.getState().preferredSelectionTool.type,
        });
      } else {
        ctx.setActiveTool({ type: shape });
      }

      event.stopPropagation();

      return;
    } else if (event.key === KEYS.Q) {
      ctx.toggleLock("keyboard");
      event.stopPropagation();
      return;
    }
  }

  if (ctx.getState().viewModeEnabled) {
    return;
  }

  if (event[KEYS.CTRL_OR_CMD] && !event.repeat) {
    if (getFeatureFlag("COMPLEX_BINDINGS")) {
      ctx.resetDelayedBindMode();
    }

    flushSync(() => {
      ctx.setState({
        isBindingEnabled:
          ctx.getState().bindingPreference !== "enabled",
      });
    });

    ctx.maybeHandleArrowPointlikeDrag(event);
  }

  if (isArrowKey(event.key)) {
    let selectedElements = ctx.scene.getSelectedElements({
      selectedElementIds: ctx.getState().selectedElementIds,
      includeBoundTextElement: true,
      includeElementsInFrames: true,
    });

    const arrowIdsToRemove = new Set<string>();

    selectedElements
      .filter((el): el is NonDeleted<ExcalidrawArrowElement> =>
        isBindingElement(el),
      )
      .filter((arrow) => {
        const startElementNotInSelection =
          arrow.startBinding &&
          !selectedElements.some(
            (el) => el.id === arrow.startBinding?.elementId,
          );
        const endElementNotInSelection =
          arrow.endBinding &&
          !selectedElements.some(
            (el) => el.id === arrow.endBinding?.elementId,
          );
        return startElementNotInSelection || endElementNotInSelection;
      })
      .forEach((arrow) => arrowIdsToRemove.add(arrow.id));

    selectedElements = selectedElements.filter(
      (el) => !arrowIdsToRemove.has(el.id),
    );

    const step =
      (ctx.getEffectiveGridSize() &&
        (event.shiftKey
          ? ELEMENT_TRANSLATE_AMOUNT
          : ctx.getEffectiveGridSize())) ||
      (event.shiftKey
        ? ELEMENT_SHIFT_TRANSLATE_AMOUNT
        : ELEMENT_TRANSLATE_AMOUNT);

    let offsetX = 0;
    let offsetY = 0;

    if (event.key === KEYS.ARROW_LEFT) {
      offsetX = -step!;
    } else if (event.key === KEYS.ARROW_RIGHT) {
      offsetX = step!;
    } else if (event.key === KEYS.ARROW_UP) {
      offsetY = -step!;
    } else if (event.key === KEYS.ARROW_DOWN) {
      offsetY = step!;
    }

    selectedElements.forEach((element) => {
      ctx.scene.mutateElement(
        element,
        {
          x: element.x + offsetX,
          y: element.y + offsetY,
        },
        { informMutation: false, isDragging: false },
      );

      updateBoundElements(element, ctx.scene, {
        simultaneouslyUpdated: selectedElements,
      });
    });

    ctx.scene.triggerUpdate();

    event.preventDefault();
  } else if (event.key === KEYS.ENTER) {
    const selectedElements = ctx.scene.getSelectedElements(ctx.getState());
    if (selectedElements.length === 1) {
      const selectedElement = selectedElements[0];
      if (event[KEYS.CTRL_OR_CMD] || isLineElement(selectedElement)) {
        if (isLinearElement(selectedElement)) {
          if (
            !ctx.getState().selectedLinearElement?.isEditing ||
            ctx.getState().selectedLinearElement?.elementId !==
              selectedElement.id
          ) {
            ctx.store.scheduleCapture();
            if (!isElbowArrow(selectedElement)) {
              ctx.actionManager.executeAction(actionToggleLinearEditor);
            }
          }
        }
      } else if (
        isTextElement(selectedElement) ||
        isValidTextContainer(selectedElement)
      ) {
        let container;
        if (!isTextElement(selectedElement)) {
          container = selectedElement as ExcalidrawTextContainer;
        }
        const midPoint = getContainerCenter(
          selectedElement,
          ctx.getState(),
          ctx.scene.getNonDeletedElementsMap(),
        );
        const sceneX = midPoint.x;
        const sceneY = midPoint.y;
        ctx.startTextEditing({
          sceneX,
          sceneY,
          container,
        });
        event.preventDefault();
        return;
      } else if (isFrameLikeElement(selectedElement)) {
        ctx.setState({
          editingFrame: selectedElement.id,
        });
      }
    }
  }

  if (event.key === KEYS.SPACE && ctx.getGesture().pointers.size === 0) {
    ctx.setIsHoldingSpace(true);
    setCursor(ctx.interactiveCanvas, CURSOR_TYPE.GRAB);
    event.preventDefault();
  }

  if (
    (event.key === KEYS.G || event.key === KEYS.S) &&
    !event.altKey &&
    !event[KEYS.CTRL_OR_CMD]
  ) {
    const selectedElements = ctx.scene.getSelectedElements(ctx.getState());
    if (
      ctx.getState().activeTool.type === "selection" &&
      !selectedElements.length
    ) {
      return;
    }

    if (
      event.key === KEYS.G &&
      (hasBackground(ctx.getState().activeTool.type) ||
        selectedElements.some((element) => hasBackground(element.type)))
    ) {
      ctx.setState({ openPopup: "elementBackground" });
      event.stopPropagation();
    }
    if (event.key === KEYS.S) {
      ctx.setState({ openPopup: "elementStroke" });
      event.stopPropagation();
    }
  }

  if (
    !event[KEYS.CTRL_OR_CMD] &&
    event.shiftKey &&
    event.key.toLowerCase() === KEYS.F
  ) {
    const selectedElements = ctx.scene.getSelectedElements(ctx.getState());

    if (
      ctx.getState().activeTool.type === "selection" &&
      !selectedElements.length
    ) {
      return;
    }

    if (
      ctx.getState().activeTool.type === "text" ||
      selectedElements.find(
        (element) =>
          isTextElement(element) ||
          getBoundTextElement(
            element,
            ctx.scene.getNonDeletedElementsMap(),
          ),
      )
    ) {
      event.preventDefault();
      ctx.setState({ openPopup: "fontFamily" });
    }
  }

  if (
    event[KEYS.CTRL_OR_CMD] &&
    (event.key === KEYS.BACKSPACE || event.key === KEYS.DELETE)
  ) {
    ctx.updateEditorAtom(activeConfirmDialogAtom, "clearCanvas");
  }

  // eye dropper
  // -----------------------------------------------------------------------
  const lowerCased = event.key.toLocaleLowerCase();
  const isPickingStroke =
    lowerCased === KEYS.S && event.shiftKey && !event[KEYS.CTRL_OR_CMD];
  const isPickingBackground =
    event.key === KEYS.I || (lowerCased === KEYS.G && event.shiftKey);

  if (isPickingStroke || isPickingBackground) {
    ctx.openEyeDropper({
      type: isPickingStroke ? "stroke" : "background",
    });
  }
  // -----------------------------------------------------------------------
}

// ---------------------------------------------------------------------------
// 2. onKeyUp
// ---------------------------------------------------------------------------

export function onKeyUp(
  ctx: AppEngineContext,
  event: KeyboardEvent,
): void {
  if (event.key === KEYS.SPACE) {
    if (
      (ctx.getState().viewModeEnabled &&
        ctx.getState().activeTool.type !== "laser") ||
      ctx.getState().openDialog?.name === "elementLinkSelector"
    ) {
      setCursor(ctx.interactiveCanvas, CURSOR_TYPE.GRAB);
    } else if (isSelectionLikeTool(ctx.getState().activeTool.type)) {
      resetCursor(ctx.interactiveCanvas);
    } else {
      setCursorForShape(ctx.interactiveCanvas, ctx.getState());
      ctx.setState({
        selectedElementIds: makeNextSelectedElementIds({}, ctx.getState()),
        selectedGroupIds: {},
        editingGroupId: null,
        activeEmbeddable: null,
      });
    }
    ctx.setIsHoldingSpace(false);
  }

  if (event.key === KEYS.ALT) {
    ctx.maybeHandleArrowPointlikeDrag(event);
  }

  if (
    (event.key === KEYS.ALT && ctx.getState().bindMode === "skip") ||
    (!event[KEYS.CTRL_OR_CMD] && !isBindingEnabled(ctx.getState()))
  ) {
    // Handle Alt key release for bind mode
    ctx.setState({
      bindMode: "orbit",
    });

    // Restart the timer if we're creating/editing a linear element and hovering over an element
    if (ctx.getLastPointerMoveEvent() && getFeatureFlag("COMPLEX_BINDINGS")) {
      const lastEvent = ctx.getLastPointerMoveEvent()!;
      const scenePointer = viewportCoordsToSceneCoords(
        {
          clientX: lastEvent.clientX,
          clientY: lastEvent.clientY,
        },
        ctx.getState(),
      );

      const hoveredElement = getHoveredElementForBinding(
        pointFrom<GlobalPoint>(scenePointer.x, scenePointer.y),
        ctx.scene.getNonDeletedElements(),
        ctx.scene.getNonDeletedElementsMap(),
      );

      if (ctx.getState().selectedLinearElement) {
        const element = LinearElementEditor.getElement(
          ctx.getState().selectedLinearElement!.elementId,
          ctx.scene.getNonDeletedElementsMap(),
        );

        if (isBindingElement(element)) {
          ctx.handleDelayedBindModeChange(
            element as ExcalidrawArrowElement,
            hoveredElement as NonDeletedExcalidrawElement | null,
          );
        }
      }
    }
  }
  if (!event[KEYS.CTRL_OR_CMD]) {
    const preferenceEnabled = ctx.getState().bindingPreference === "enabled";
    if (ctx.getState().isBindingEnabled !== preferenceEnabled) {
      flushSync(() => {
        ctx.setState({ isBindingEnabled: preferenceEnabled });
      });
    }

    ctx.maybeHandleArrowPointlikeDrag(event);
  }
  if (isArrowKey(event.key)) {
    bindOrUnbindBindingElements(
      ctx.scene.getSelectedElements(ctx.getState()).filter(isArrowElement),
      ctx.scene,
      ctx.getState(),
    );

    const elementsMap = ctx.scene.getNonDeletedElementsMap();

    ctx.scene
      .getSelectedElements(ctx.getState())
      .filter(isSimpleArrow)
      .forEach((element) => {
        // Update the fixed point bindings for non-elbow arrows
        // when the pointer is released, so that they are correctly positioned
        // after the drag.
        if (element.startBinding) {
          ctx.scene.mutateElement(element, {
            startBinding: {
              ...element.startBinding,
              ...calculateFixedPointForNonElbowArrowBinding(
                element,
                elementsMap.get(
                  element.startBinding.elementId,
                ) as ExcalidrawBindableElement,
                "start",
                elementsMap,
              ),
            },
          });
        }
        if (element.endBinding) {
          ctx.scene.mutateElement(element, {
            endBinding: {
              ...element.endBinding,
              ...calculateFixedPointForNonElbowArrowBinding(
                element,
                elementsMap.get(
                  element.endBinding.elementId,
                ) as ExcalidrawBindableElement,
                "end",
                elementsMap,
              ),
            },
          });
        }
      });

    ctx.setState({ suggestedBinding: null });
  }

  if (!event.altKey) {
    if (ctx.flowChartNavigator.isExploring) {
      ctx.flowChartNavigator.clear();
      ctx.syncActionResult({
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    }
  }

  if (!event[KEYS.CTRL_OR_CMD]) {
    if (ctx.flowChartCreator.isCreatingChart) {
      if (ctx.flowChartCreator.pendingNodes?.length) {
        ctx.scene.insertElements(ctx.flowChartCreator.pendingNodes);
      }

      const firstNode = ctx.flowChartCreator.pendingNodes?.[0];

      if (firstNode) {
        ctx.setState((prevState) => ({
          selectedElementIds: makeNextSelectedElementIds(
            {
              [firstNode.id]: true,
            },
            prevState,
          ),
        }));

        if (
          !isElementCompletelyInViewport(
            [firstNode],
            ctx.canvas!.width / window.devicePixelRatio,
            ctx.canvas!.height / window.devicePixelRatio,
            {
              offsetLeft: ctx.getState().offsetLeft,
              offsetTop: ctx.getState().offsetTop,
              scrollX: ctx.getState().scrollX,
              scrollY: ctx.getState().scrollY,
              zoom: ctx.getState().zoom,
            },
            ctx.scene.getNonDeletedElementsMap(),
            ctx.getEditorUIOffsets(),
          )
        ) {
          ctx.scrollToContent(firstNode, {
            animate: true,
            duration: 300,
            canvasOffsets: ctx.getEditorUIOffsets(),
          });
        }
      }

      ctx.flowChartCreator.clear();
      ctx.syncActionResult({
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    }
  }
}
