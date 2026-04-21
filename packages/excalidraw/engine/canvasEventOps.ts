import type React from "react";

import {
  DOUBLE_TAP_POSITION_THRESHOLD,
  DRAGGING_THRESHOLD,
  EVENT,
  KEYS,
  POINTER_BUTTON,
  getFeatureFlag,
  isLocalLink,
  isTransparent,
  normalizeLink,
  viewportCoordsToSceneCoords,
  wrapEvent,
} from "@excalidraw/common";

import {
  LinearElementEditor,
  getContainerCenter,
  getSelectedGroupIdForElement,
  getSelectedGroupIds,
  hasBoundTextElement,
  hitElementItself,
  isElbowArrow,
  isIframeLikeElement,
  isImageElement,
  isLinearElement,
  isLineElement,
  isSimpleArrow,
  selectGroupsForSelectedElements,
} from "@excalidraw/element";

import { trackEvent } from "../analytics";

import { pointDistance, pointFrom } from "@excalidraw/math";

import { actionToggleLinearEditor } from "../actions";
import {
  hideHyperlinkToolip,
} from "../components/hyperlink/Hyperlink";
import { isPointHittingLink } from "../components/hyperlink/helpers";
import { resetCursor } from "../cursor";

import type { ExcalidrawLinearElement } from "@excalidraw/element/types";

import type { AppEngineContext } from "./AppEngineContext";

function shouldHandleBrowserCanvasDoubleClick(
  ctx: AppEngineContext,
  type: string,
): boolean {
  if (type === "touch") {
    return true;
  }
  const clicks = ctx.getLastCompletedCanvasClicks();
  if (clicks.length === 0) {
    return true;
  }
  if (clicks.length < 2) {
    return false;
  }

  const [firstClick, secondClick] = clicks;

  return (
    pointDistance(
      pointFrom(firstClick.x, firstClick.y),
      pointFrom(secondClick.x, secondClick.y),
    ) <= DOUBLE_TAP_POSITION_THRESHOLD
  );
}

export function handleCanvasClick(
  ctx: AppEngineContext,
  event: React.MouseEvent<HTMLCanvasElement>,
): void {
  if (event.button !== POINTER_BUTTON.MAIN) {
    ctx.setLastCompletedCanvasClicks([]);
    return;
  }

  const prev = ctx.getLastCompletedCanvasClicks();
  ctx.setLastCompletedCanvasClicks([
    ...prev.slice(-1),
    {
      x: event.clientX,
      y: event.clientY,
    },
  ]);
}

export function handleCanvasDoubleClick(
  ctx: AppEngineContext,
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
): void {
  const state = ctx.getState();
  if (
    state.editingTextElement ||
    !shouldHandleBrowserCanvasDoubleClick(ctx, event.type)
  ) {
    return;
  }
  if (state.multiElement) {
    return;
  }
  if (state.activeTool.type !== state.preferredSelectionTool.type) {
    return;
  }

  const selectedElements = ctx.scene.getSelectedElements(state);

  let { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
    event,
    state,
  );

  if (selectedElements.length === 1 && isLinearElement(selectedElements[0])) {
    const selectedLinearElement: ExcalidrawLinearElement =
      selectedElements[0];
    if (
      ((event[KEYS.CTRL_OR_CMD] && isSimpleArrow(selectedLinearElement)) ||
        isLineElement(selectedLinearElement)) &&
      (!ctx.getState().selectedLinearElement?.isEditing ||
        ctx.getState().selectedLinearElement!.elementId !==
          selectedLinearElement.id)
    ) {
      ctx.actionManager.executeAction(actionToggleLinearEditor);
      return;
    } else if (
      ctx.getState().selectedLinearElement &&
      isElbowArrow(selectedElements[0])
    ) {
      const linearEditor = ctx.getState().selectedLinearElement!;
      const hitCoords = LinearElementEditor.getSegmentMidpointHitCoords(
        linearEditor,
        { x: sceneX, y: sceneY },
        ctx.getState(),
        ctx.scene.getNonDeletedElementsMap(),
      );
      const midPoint = hitCoords
        ? LinearElementEditor.getSegmentMidPointIndex(
            linearEditor,
            ctx.getState(),
            hitCoords,
            ctx.scene.getNonDeletedElementsMap(),
          )
        : -1;

      if (midPoint && midPoint > -1) {
        ctx.store.scheduleCapture();
        LinearElementEditor.deleteFixedSegment(
          selectedElements[0],
          ctx.scene,
          midPoint,
        );

        const nextCoords = LinearElementEditor.getSegmentMidpointHitCoords(
          {
            ...linearEditor,
            segmentMidPointHoveredCoords: null,
          },
          { x: sceneX, y: sceneY },
          ctx.getState(),
          ctx.scene.getNonDeletedElementsMap(),
        );
        const nextIndex = nextCoords
          ? LinearElementEditor.getSegmentMidPointIndex(
              linearEditor,
              ctx.getState(),
              nextCoords,
              ctx.scene.getNonDeletedElementsMap(),
            )
          : null;

        ctx.setState({
          selectedLinearElement: {
            ...linearEditor,
            initialState: {
              ...linearEditor.initialState!,
              segmentMidpoint: {
                index: nextIndex,
                value: hitCoords,
                added: false,
              },
            },
            segmentMidPointHoveredCoords: nextCoords,
          },
        });

        return;
      }
    } else if (
      ctx.getState().selectedLinearElement?.isEditing &&
      ctx.getState().selectedLinearElement!.elementId ===
        selectedLinearElement.id &&
      isLineElement(selectedLinearElement)
    ) {
      return;
    }
  }

  if (selectedElements.length === 1 && isImageElement(selectedElements[0])) {
    ctx.startImageCropping(selectedElements[0]);
    return;
  }

  resetCursor(ctx.interactiveCanvas);

  const selectedGroupIds = getSelectedGroupIds(ctx.getState());

  if (selectedGroupIds.length > 0) {
    const hitElement = ctx.getElementAtPosition(sceneX, sceneY);

    const selectedGroupId =
      hitElement &&
      getSelectedGroupIdForElement(hitElement, ctx.getState().selectedGroupIds);

    if (selectedGroupId) {
      ctx.store.scheduleCapture();
      ctx.setState((prevState) => ({
        ...prevState,
        ...selectGroupsForSelectedElements(
          {
            editingGroupId: selectedGroupId,
            selectedElementIds: { [hitElement!.id]: true },
          },
          ctx.scene.getNonDeletedElements(),
          prevState,
          null,
        ),
      }));
      return;
    }
  }

  resetCursor(ctx.interactiveCanvas);
  if (!event[KEYS.CTRL_OR_CMD] && !ctx.getState().viewModeEnabled) {
    const hitElement = ctx.getElementAtPosition(sceneX, sceneY);

    if (isIframeLikeElement(hitElement)) {
      ctx.setState({
        activeEmbeddable: { element: hitElement, state: "active" },
      });
      return;
    }

    if (!ctx.getState().selectedLinearElement?.isEditing) {
      const container = ctx.getTextBindableContainerAtPosition(sceneX, sceneY);

      if (container) {
        if (
          hasBoundTextElement(container) ||
          !isTransparent(container.backgroundColor) ||
          hitElementItself({
            point: pointFrom(sceneX, sceneY),
            element: container,
            elementsMap: ctx.scene.getNonDeletedElementsMap(),
            threshold: ctx.getElementHitThreshold(container),
          })
        ) {
          const midPoint = getContainerCenter(
            container,
            ctx.getState(),
            ctx.scene.getNonDeletedElementsMap(),
          );

          sceneX = midPoint.x;
          sceneY = midPoint.y;
        }
      }

      ctx.startTextEditing({
        sceneX,
        sceneY,
        insertAtParentCenter: !event.altKey,
        container,
      });
    }
  }
}

export function handleElementLinkClick(
  ctx: AppEngineContext,
  event: React.PointerEvent<HTMLCanvasElement>,
): void {
  const lastPointerDownEvent = ctx.getLastPointerDownEvent();
  const lastPointerUpEvent = ctx.getLastPointerUpEvent();
  const hitLinkElement = ctx.getHitLinkElement();
  const draggedDistance = pointDistance(
    pointFrom(
      lastPointerDownEvent!.clientX,
      lastPointerDownEvent!.clientY,
    ),
    pointFrom(
      lastPointerUpEvent!.clientX,
      lastPointerUpEvent!.clientY,
    ),
  );
  if (!hitLinkElement || draggedDistance > DRAGGING_THRESHOLD) {
    return;
  }
  const lastPointerDownCoords = viewportCoordsToSceneCoords(
    lastPointerDownEvent!,
    ctx.getState(),
  );
  const elementsMap = ctx.scene.getNonDeletedElementsMap();
  const lastPointerDownHittingLinkIcon = isPointHittingLink(
    hitLinkElement,
    elementsMap,
    ctx.getState(),
    pointFrom(lastPointerDownCoords.x, lastPointerDownCoords.y),
    ctx.editorInterface.formFactor === "phone",
  );
  const lastPointerUpCoords = viewportCoordsToSceneCoords(
    lastPointerUpEvent!,
    ctx.getState(),
  );
  const lastPointerUpHittingLinkIcon = isPointHittingLink(
    hitLinkElement,
    elementsMap,
    ctx.getState(),
    pointFrom(lastPointerUpCoords.x, lastPointerUpCoords.y),
    ctx.editorInterface.formFactor === "phone",
  );
  if (lastPointerDownHittingLinkIcon && lastPointerUpHittingLinkIcon) {
    hideHyperlinkToolip();
    let url = hitLinkElement.link;
    if (url) {
      url = normalizeLink(url);
      let customEvent: CustomEvent | undefined;
      if (ctx.propOnLinkOpen) {
        customEvent = wrapEvent(EVENT.EXCALIDRAW_LINK, event.nativeEvent);
        ctx.propOnLinkOpen(
          {
            ...hitLinkElement,
            link: url,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          customEvent as any,
        );
      }
      if (!customEvent?.defaultPrevented) {
        const target = isLocalLink(url) ? "_self" : "_blank";
        const newWindow = window.open(undefined, target);
        if (newWindow) {
          newWindow.opener = null;
          newWindow.location = url;
        }
      }
    }
  }
}

export function handleCanvasPointerUp(
  ctx: AppEngineContext,
  event: React.PointerEvent<HTMLCanvasElement>,
): void {
  if (getFeatureFlag("COMPLEX_BINDINGS")) {
    ctx.resetDelayedBindMode();
  }

  ctx.removePointer(event);
  ctx.setLastPointerUpIsDoubleClick(
    ctx.isDoubleClick(ctx.getLastPointerUpEvent(), event),
  );
  ctx.setLastPointerUpEvent(event);

  if (!event.ctrlKey) {
    const preferenceEnabled = ctx.getState().bindingPreference === "enabled";
    if (ctx.getState().isBindingEnabled !== preferenceEnabled) {
      ctx.setState({ isBindingEnabled: preferenceEnabled });
    }
  }

  const scenePointer = viewportCoordsToSceneCoords(
    { clientX: event.clientX, clientY: event.clientY },
    ctx.getState(),
  );
  const { x: scenePointerX, y: scenePointerY } = scenePointer;
  ctx.setLastPointerMoveCoords({
    x: scenePointerX,
    y: scenePointerY,
  });

  if (ctx.handleIframeLikeCenterClick()) {
    return;
  }

  if (ctx.editorInterface.isTouchScreen) {
    const hitElement = ctx.getElementAtPosition(
      scenePointer.x,
      scenePointer.y,
      {
        includeLockedElements: true,
      },
    );
    ctx.setHitLinkElement(
      ctx.getElementLinkAtPosition(scenePointer, hitElement) as
        | // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any,
    );
  }

  const hitLinkElement = ctx.getHitLinkElement();
  if (
    hitLinkElement &&
    !ctx.getState().selectedElementIds[hitLinkElement.id]
  ) {
    ctx.handleElementLinkClick(event);
  } else if (ctx.getState().viewModeEnabled) {
    ctx.setState({
      activeEmbeddable: null,
      selectedElementIds: {},
    });
  }
}

export function handleCanvasContextMenu(
  ctx: AppEngineContext,
  event: React.MouseEvent<HTMLElement | HTMLCanvasElement>,
): void {
  event.preventDefault();

  if (
    (("pointerType" in event.nativeEvent &&
      event.nativeEvent.pointerType === "touch") ||
      ("pointerType" in event.nativeEvent &&
        event.nativeEvent.pointerType === "pen" &&
        event.button !== POINTER_BUTTON.SECONDARY)) &&
    ctx.getState().activeTool.type !== ctx.getState().preferredSelectionTool.type
  ) {
    return;
  }

  const { x, y } = viewportCoordsToSceneCoords(event, ctx.getState());
  const element = ctx.getElementAtPosition(x, y, {
    preferSelected: true,
    includeLockedElements: true,
  });

  const selectedElements = ctx.scene.getSelectedElements(ctx.getState());
  const isHittingCommonBoundBox =
    ctx.isHittingCommonBoundingBoxOfSelectedElements(
      { x, y },
      selectedElements,
    );

  const type = element || isHittingCommonBoundBox ? "element" : "canvas";

  const container = ctx.excalidrawContainerRef.current!;
  const { top: offsetTop, left: offsetLeft } =
    container.getBoundingClientRect();
  const left = event.clientX - offsetLeft;
  const top = event.clientY - offsetTop;

  trackEvent("contextMenu", "openContextMenu", type);

  ctx.setState(
    {
      ...(element && !ctx.getState().selectedElementIds[element.id]
        ? {
            ...ctx.getState(),
            ...selectGroupsForSelectedElements(
              {
                editingGroupId: ctx.getState().editingGroupId,
                selectedElementIds: { [element.id]: true },
              },
              ctx.scene.getNonDeletedElements(),
              ctx.getState(),
              null,
            ),
            selectedLinearElement: isLinearElement(element)
              ? new LinearElementEditor(
                  element,
                  ctx.scene.getNonDeletedElementsMap(),
                )
              : null,
          }
        : ctx.getState()),
      showHyperlinkPopup: false,
    },
    () => {
      ctx.setState({
        contextMenu: { top, left, items: ctx.getContextMenuItems(type) },
      });
    },
  );
}
