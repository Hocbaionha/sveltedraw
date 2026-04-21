import type React from "react";

import {
  EVENT,
  KEYS,
  getGridPoint,
  tupleToCoors,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import {
  deepCopyElement,
  getCommonBounds,
  isElbowArrow,
  isElementInGroup,
  makeNextSelectedElementIds,
} from "@excalidraw/element";

import { setCursorForShape } from "../cursor";
import {
  withBatchedUpdates,
  withBatchedUpdatesThrottled,
} from "../reactUtils";
import { isOverScrollBars } from "../scene/scrollbars";
import { getCenter, getDistance } from "../gesture";

import type {
  CollaboratorPointer,
  PointerDownState,
} from "../types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { AppEngineContext } from "./AppEngineContext";

export function maybeUnfollowRemoteUser(ctx: AppEngineContext): void {
  if (ctx.getState().userToFollow) {
    ctx.setState({ userToFollow: null });
  }
}

export function updateGestureOnPointerDown(
  ctx: AppEngineContext,
  event: React.PointerEvent<HTMLElement>,
): void {
  const gesture = ctx.getGesture();
  gesture.pointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
  });

  if (gesture.pointers.size === 2) {
    gesture.lastCenter = getCenter(gesture.pointers);
    gesture.initialScale = ctx.getState().zoom.value;
    gesture.initialDistance = getDistance(
      Array.from(gesture.pointers.values()),
    );
  }
}

export function initialPointerDownState(
  ctx: AppEngineContext,
  event: React.PointerEvent<HTMLElement>,
): PointerDownState {
  const state = ctx.getState();
  const origin = viewportCoordsToSceneCoords(event, state);
  const selectedElements = ctx.scene.getSelectedElements(state);
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
          : ctx.getEffectiveGridSize(),
      ),
    ),
    scrollbars: isOverScrollBars(
      ctx.getCurrentScrollBars(),
      event.clientX - state.offsetLeft,
      event.clientY - state.offsetTop,
    ),
    lastCoords: { ...origin },
    originalElements: ctx.scene
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
        ctx.isHittingCommonBoundingBoxOfSelectedElements(
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

export function handleDraggingScrollBar(
  ctx: AppEngineContext,
  event: React.PointerEvent<HTMLElement>,
  pointerDownState: PointerDownState,
): boolean {
  if (
    !(pointerDownState.scrollbars.isOverEither && !ctx.getState().multiElement)
  ) {
    return false;
  }
  ctx.setIsDraggingScrollBar(true);
  pointerDownState.lastCoords.x = event.clientX;
  pointerDownState.lastCoords.y = event.clientY;
  const onPointerMove = withBatchedUpdatesThrottled((event: PointerEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    ctx.handlePointerMoveOverScrollbars(event, pointerDownState);
  });
  const onPointerUp = withBatchedUpdates(() => {
    ctx.setLastPointerUp(null);
    ctx.setIsDraggingScrollBar(false);
    setCursorForShape(ctx.interactiveCanvas, ctx.getState());
    ctx.setState({
      cursorButton: "up",
    });
    ctx.savePointer(event.clientX, event.clientY, "up");
    window.removeEventListener(EVENT.POINTER_MOVE, onPointerMove);
    window.removeEventListener(EVENT.POINTER_UP, onPointerUp);
    onPointerMove.flush();
  });

  ctx.setLastPointerUp(onPointerUp);

  window.addEventListener(EVENT.POINTER_MOVE, onPointerMove);
  window.addEventListener(EVENT.POINTER_UP, onPointerUp);
  return true;
}

export function clearSelection(
  ctx: AppEngineContext,
  hitElement: ExcalidrawElement | null,
): void {
  ctx.setState((prevState) => ({
    selectedElementIds: makeNextSelectedElementIds({}, prevState),
    activeEmbeddable: null,
    selectedGroupIds: {},
    editingGroupId:
      prevState.editingGroupId &&
      hitElement != null &&
      isElementInGroup(hitElement, prevState.editingGroupId)
        ? prevState.editingGroupId
        : null,
  }));
  ctx.setState({
    selectedElementIds: makeNextSelectedElementIds({}, ctx.getState()),
    activeEmbeddable: null,
    previousSelectedElementIds: ctx.getState().selectedElementIds,
    selectedLinearElement: null,
  });
}

export function savePointer(
  ctx: AppEngineContext,
  x: number,
  y: number,
  button: "up" | "down",
): void {
  if (!x || !y) {
    return;
  }
  const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
    { clientX: x, clientY: y },
    ctx.getState(),
  );

  if (isNaN(sceneX) || isNaN(sceneY)) {
    // sometimes the pointer goes off screen
  }

  const pointer: CollaboratorPointer = {
    x: sceneX,
    y: sceneY,
    tool: ctx.getState().activeTool.type === "laser" ? "laser" : "pointer",
  };

  ctx.propOnPointerUpdate?.({
    pointer,
    button,
    pointersMap: ctx.getGesture().pointers,
  });
}
