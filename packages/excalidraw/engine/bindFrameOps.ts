import { flushSync } from "react-dom";

import {
  BIND_MODE_TIMEOUT,
  CURSOR_TYPE,
  DRAGGING_THRESHOLD,
  POINTER_BUTTON,
  TAP_TWICE_TIMEOUT,
  invariant,
  oneOf,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import {
  LinearElementEditor,
  doBoundsIntersect,
  getElementBounds,
  getHoveredElementForBinding,
  isCursorInFrame,
  isElbowArrow,
  isIframeElement,
  isIframeLikeElement,
} from "@excalidraw/element";

import { pointDistance, pointFrom } from "@excalidraw/math";
import type { GlobalPoint } from "@excalidraw/math";

import { YOUTUBE_STATES } from "@excalidraw/common";

import type { ValueOf } from "@excalidraw/common/utility-types";

import { setCursor } from "../cursor";

import { YOUTUBE_VIDEO_STATES } from "./youtubeStates";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  ExcalidrawIframeLikeElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type React from "react";

import type { AppEngineContext } from "./AppEngineContext";

export function onWindowMessage(
  _ctx: AppEngineContext,
  event: MessageEvent,
): void {
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

export function getFrameNameDOMId(
  ctx: AppEngineContext,
  frameElement: ExcalidrawElement,
): string {
  return `${ctx.getAppId()}-frame-name-${frameElement.id}`;
}

export function resetEditingFrame(
  ctx: AppEngineContext,
  frame: ExcalidrawFrameLikeElement | null,
): void {
  if (frame) {
    ctx.scene.mutateElement(frame, { name: frame.name?.trim() || null });
  }
  ctx.setState({ editingFrame: null });
}

export function getTopLayerFrameAtSceneCoords(
  ctx: AppEngineContext,
  sceneCoords: { x: number; y: number },
): ExcalidrawFrameLikeElement | null {
  const elementsMap = ctx.scene.getNonDeletedElementsMap();
  const frames = ctx.scene
    .getNonDeletedFramesLikes()
    .filter(
      (frame): frame is ExcalidrawFrameLikeElement =>
        !frame.locked && isCursorInFrame(sceneCoords, frame, elementsMap),
    );

  return frames.length ? frames[frames.length - 1] : null;
}

export function isDoubleClick(
  _ctx: AppEngineContext,
  lastPointerEvent:
    | PointerEvent
    | React.PointerEvent<HTMLElement>
    | undefined
    | null,
  currentPointerEvent: PointerEvent | React.PointerEvent<HTMLElement>,
): boolean {
  return (
    lastPointerEvent != null &&
    currentPointerEvent.timeStamp - lastPointerEvent.timeStamp <=
      TAP_TWICE_TIMEOUT
  );
}

export function isIframeLikeElementCenter(
  ctx: AppEngineContext,
  el: ExcalidrawIframeLikeElement | null,
  event: React.PointerEvent<HTMLElement> | PointerEvent,
  sceneX: number,
  sceneY: number,
): boolean {
  return !!(
    el &&
    !event.altKey &&
    !event.shiftKey &&
    !event.metaKey &&
    !event.ctrlKey &&
    (ctx.getState().activeEmbeddable?.element !== el ||
      ctx.getState().activeEmbeddable?.state === "hover" ||
      !ctx.getState().activeEmbeddable) &&
    sceneX >= el.x + el.width / 3 &&
    sceneX <= el.x + (2 * el.width) / 3 &&
    sceneY >= el.y + el.height / 3 &&
    sceneY <= el.y + (2 * el.height) / 3
  );
}

export function handleIframeLikeElementHover(
  ctx: AppEngineContext,
  {
    hitElement,
    scenePointer,
    moveEvent,
  }: {
    hitElement: NonDeleted<ExcalidrawElement> | null;
    scenePointer: { x: number; y: number };
    moveEvent: React.PointerEvent<HTMLCanvasElement>;
  },
): boolean {
  if (
    hitElement &&
    isIframeLikeElement(hitElement) &&
    (ctx.getState().viewModeEnabled ||
      ctx.getState().activeTool.type === "laser" ||
      isIframeLikeElementCenter(
        ctx,
        hitElement,
        moveEvent,
        scenePointer.x,
        scenePointer.y,
      ))
  ) {
    setCursor(ctx.interactiveCanvas, CURSOR_TYPE.POINTER);
    ctx.setState({
      activeEmbeddable: { element: hitElement, state: "hover" },
    });
    return true;
  } else if (ctx.getState().activeEmbeddable?.state === "hover") {
    ctx.setState({ activeEmbeddable: null });
  }
  return false;
}

export function handleIframeLikeCenterClick(
  ctx: AppEngineContext,
): boolean {
  const lastPointerDownEvent = ctx.getLastPointerDownEvent();
  const lastPointerUpEvent = ctx.getLastPointerUpEvent();
  if (
    !lastPointerDownEvent ||
    !lastPointerUpEvent ||
    lastPointerDownEvent.button !== POINTER_BUTTON.MAIN ||
    ctx.getIsHoldingSpace() ||
    !oneOf(ctx.getState().activeTool.type, ["laser", "selection", "lasso"])
  ) {
    return false;
  }

  const viewportClickStart_scenePoint = pointFrom<GlobalPoint>(
    ...(Object.values(
      viewportCoordsToSceneCoords(
        {
          clientX: lastPointerDownEvent.clientX,
          clientY: lastPointerDownEvent.clientY,
        },
        ctx.getState(),
      ),
    ) as [number, number]),
  );
  const viewportClickEnd_scenePoint = pointFrom<GlobalPoint>(
    ...(Object.values(
      viewportCoordsToSceneCoords(
        {
          clientX: lastPointerUpEvent.clientX,
          clientY: lastPointerUpEvent.clientY,
        },
        ctx.getState(),
      ),
    ) as [number, number]),
  );

  const draggedDistance = pointDistance(
    viewportClickStart_scenePoint,
    viewportClickEnd_scenePoint,
  );

  if (draggedDistance > DRAGGING_THRESHOLD) {
    return false;
  }

  const hitElement = ctx.getElementAtPosition(
    viewportClickStart_scenePoint[0],
    viewportClickStart_scenePoint[1],
  );

  const shouldActivate =
    hitElement &&
    lastPointerUpEvent.timeStamp - lastPointerDownEvent.timeStamp <= 300 &&
    ctx.getGesture().pointers.size < 2 &&
    isIframeLikeElement(hitElement) &&
    (ctx.getState().viewModeEnabled ||
      ctx.getState().activeTool.type === "laser" ||
      isIframeLikeElementCenter(
        ctx,
        hitElement,
        lastPointerUpEvent,
        viewportClickEnd_scenePoint[0],
        viewportClickEnd_scenePoint[1],
      ));

  if (!shouldActivate) {
    return false;
  }

  const iframeLikeElement = hitElement;

  if (
    ctx.getState().activeEmbeddable?.element === iframeLikeElement &&
    ctx.getState().activeEmbeddable?.state === "active"
  ) {
    return true;
  }

  setTimeout(() => {
    ctx.setState({
      activeEmbeddable: { element: iframeLikeElement, state: "active" },
      selectedElementIds: { [iframeLikeElement.id]: true },
      newElement: null,
      selectionElement: null,
    });
  }, 100);

  if (isIframeElement(iframeLikeElement)) {
    return true;
  }

  const iframe = ctx.getHTMLIFrameElement(iframeLikeElement);

  if (!iframe?.contentWindow) {
    return true;
  }

  if (iframe.src.includes("youtube")) {
    const state = YOUTUBE_VIDEO_STATES.get(iframeLikeElement.id);
    if (!state) {
      YOUTUBE_VIDEO_STATES.set(iframeLikeElement.id, YOUTUBE_STATES.UNSTARTED);
      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: "listening",
          id: iframeLikeElement.id,
        }),
        "*",
      );
    }
    switch (state) {
      case YOUTUBE_STATES.PLAYING:
      case YOUTUBE_STATES.BUFFERING:
        iframe.contentWindow?.postMessage(
          JSON.stringify({
            event: "command",
            func: "pauseVideo",
            args: "",
          }),
          "*",
        );
        break;
      default:
        iframe.contentWindow?.postMessage(
          JSON.stringify({
            event: "command",
            func: "playVideo",
            args: "",
          }),
          "*",
        );
    }
  }

  if (iframe.src.includes("player.vimeo.com")) {
    iframe.contentWindow.postMessage(
      JSON.stringify({
        method: "paused",
      }),
      "*",
    );
  }

  return true;
}

export function handleSkipBindMode(ctx: AppEngineContext): void {
  const state = ctx.getState();
  const lastPointerMoveCoords = ctx.getLastPointerMoveCoords();
  if (
    state.selectedLinearElement?.initialState &&
    !state.selectedLinearElement.initialState.arrowStartIsInside
  ) {
    invariant(
      lastPointerMoveCoords,
      "Missing last pointer move coords when changing bind skip mode for arrow start",
    );
    const elementsMap = ctx.scene.getNonDeletedElementsMap();
    const hoveredElement = getHoveredElementForBinding(
      pointFrom<GlobalPoint>(
        lastPointerMoveCoords.x,
        lastPointerMoveCoords.y,
      ),
      ctx.scene.getNonDeletedElements(),
      elementsMap,
    );
    const element = LinearElementEditor.getElement(
      state.selectedLinearElement.elementId,
      elementsMap,
    );

    if (
      element?.startBinding &&
      hoveredElement?.id === element.startBinding.elementId
    ) {
      ctx.setState({
        selectedLinearElement: {
          ...state.selectedLinearElement,
          initialState: {
            ...state.selectedLinearElement.initialState,
            arrowStartIsInside: true,
          },
        },
      });
    }
  }

  if (ctx.getState().bindMode === "orbit") {
    const handler = ctx.getBindModeHandler();
    if (handler) {
      clearTimeout(handler);
      ctx.setBindModeHandler(null);
    }

    flushSync(() => {
      ctx.setState({
        bindMode: "skip",
      });
    });

    const coords = ctx.getLastPointerMoveCoords();
    const sel = ctx.getState().selectedLinearElement;
    if (
      coords &&
      sel?.selectedPointsIndices &&
      sel.selectedPointsIndices.length
    ) {
      const { x, y } = coords;
      const event =
        ctx.getLastPointerMoveEvent() ??
        ctx.getLastPointerDownEvent()?.nativeEvent;
      invariant(event, "Last event must exist");
      const deltaX = x - sel.pointerOffset.x;
      const deltaY = y - sel.pointerOffset.y;
      const newState = ctx.getState().multiElement
        ? ctx.linearElementEditor_handlePointerMove(
            event,
            deltaX,
            deltaY,
            sel,
          )
        : ctx.linearElementEditor_handlePointDragging(
            event,
            deltaX,
            deltaY,
            sel,
          );
      if (newState) {
        ctx.setState(newState);
      }
    }
  }
}

export function resetDelayedBindMode(ctx: AppEngineContext): void {
  const handler = ctx.getBindModeHandler();
  if (handler) {
    clearTimeout(handler);
    ctx.setBindModeHandler(null);
  }

  if (ctx.getState().bindMode !== "orbit") {
    setTimeout(() =>
      ctx.setState({
        bindMode: "orbit",
      }),
    );
  }
}

export function handleDelayedBindModeChange(
  ctx: AppEngineContext,
  arrow: ExcalidrawArrowElement,
  hoveredElement: NonDeletedExcalidrawElement | null,
): void {
  if (arrow.isDeleted || isElbowArrow(arrow)) {
    return;
  }

  const effector = () => {
    ctx.setBindModeHandler(null);

    const lastCoords = ctx.getLastPointerMoveCoords();
    invariant(lastCoords, "Expected lastPointerMoveCoords to be set");

    if (!ctx.getState().multiElement) {
      const sel = ctx.getState().selectedLinearElement;
      if (
        !sel ||
        !sel.selectedPointsIndices ||
        !sel.selectedPointsIndices.length
      ) {
        return;
      }

      const startDragged = sel.selectedPointsIndices.includes(0);
      const endDragged = sel.selectedPointsIndices.includes(
        arrow.points.length - 1,
      );

      if ((!startDragged && !endDragged) || (startDragged && endDragged)) {
        return;
      }
    }

    const { x, y } = lastCoords;
    const innerHovered = getHoveredElementForBinding(
      pointFrom<GlobalPoint>(x, y),
      ctx.scene.getNonDeletedElements(),
      ctx.scene.getNonDeletedElementsMap(),
    );

    if (innerHovered && ctx.getState().bindMode !== "skip") {
      const sel = ctx.getState().selectedLinearElement;
      invariant(
        sel?.elementId === arrow.id,
        "The selectedLinearElement is expected to not change while a bind mode timeout is ticking",
      );

      const arrowStartIsInside =
        sel.initialState.arrowStartIsInside ||
        arrow.startBinding?.elementId === innerHovered.id;

      flushSync(() => {
        const sel2 = ctx.getState().selectedLinearElement;
        invariant(sel2, "ctx.getState().selectedLinearElement must exist");

        ctx.setState({
          bindMode: "inside",
          selectedLinearElement: {
            ...sel2,
            initialState: {
              ...sel2.initialState,
              arrowStartIsInside,
            },
          },
        });
      });

      const event =
        ctx.getLastPointerMoveEvent() ??
        ctx.getLastPointerDownEvent()?.nativeEvent;
      invariant(event, "Last event must exist");
      const deltaX = x - sel.pointerOffset.x;
      const deltaY = y - sel.pointerOffset.y;
      const newState = ctx.getState().multiElement
        ? ctx.linearElementEditor_handlePointerMove(
            event,
            deltaX,
            deltaY,
            sel,
          )
        : ctx.linearElementEditor_handlePointDragging(
            event,
            deltaX,
            deltaY,
            sel,
          );
      if (newState) {
        ctx.setState(newState);
      }
    }
  };

  let isOverlapping = false;
  const sel = ctx.getState().selectedLinearElement;
  if (sel?.selectedPointsIndices) {
    const elementsMap = ctx.scene.getNonDeletedElementsMap();
    const startDragged = sel.selectedPointsIndices.includes(0);
    const endDragged = sel.selectedPointsIndices.includes(
      arrow.points.length - 1,
    );
    const startElement = startDragged
      ? hoveredElement
      : arrow.startBinding && elementsMap.get(arrow.startBinding.elementId);
    const endElement = endDragged
      ? hoveredElement
      : arrow.endBinding && elementsMap.get(arrow.endBinding.elementId);
    const startBounds =
      startElement && getElementBounds(startElement, elementsMap);
    const endBounds = endElement && getElementBounds(endElement, elementsMap);
    isOverlapping = !!(
      startBounds &&
      endBounds &&
      startElement.id !== endElement.id &&
      doBoundsIntersect(startBounds, endBounds)
    );
  }

  const sel2 = ctx.getState().selectedLinearElement;
  const startDragged = sel2?.selectedPointsIndices?.includes(0);
  const endDragged = sel2?.selectedPointsIndices?.includes(
    arrow.points.length - 1,
  );
  const currentBinding = startDragged
    ? "startBinding"
    : endDragged
    ? "endBinding"
    : null;
  const otherBinding = startDragged
    ? "endBinding"
    : endDragged
    ? "startBinding"
    : null;
  const isAlreadyInsideBindingToSameElement =
    (otherBinding &&
      arrow[otherBinding]?.mode === "inside" &&
      arrow[otherBinding]?.elementId === hoveredElement?.id) ||
    (currentBinding &&
      arrow[currentBinding]?.mode === "inside" &&
      hoveredElement?.id === arrow[currentBinding]?.elementId);

  if (
    currentBinding &&
    otherBinding &&
    arrow[currentBinding]?.mode === "inside" &&
    hoveredElement?.id !== arrow[currentBinding]?.elementId &&
    arrow[otherBinding]?.elementId !== arrow[currentBinding]?.elementId
  ) {
    ctx.scene.mutateElement(
      arrow,
      {
        [currentBinding]: {
          ...arrow[currentBinding],
          mode: "orbit",
        },
      },
      {
        informMutation: false,
        isDragging: true,
      },
    );
  }

  const previousHoveredBindableElement =
    ctx.getPreviousHoveredBindableElement();

  if (
    !hoveredElement ||
    (previousHoveredBindableElement &&
      hoveredElement.id !== previousHoveredBindableElement.id)
  ) {
    const handler = ctx.getBindModeHandler();
    if (handler) {
      clearTimeout(handler);
      ctx.setBindModeHandler(null);
    }

    if (ctx.getState().bindMode === "inside") {
      flushSync(() => {
        ctx.setState({
          bindMode: "orbit",
        });
      });
    }

    ctx.setPreviousHoveredBindableElement(null);
  } else if (
    !ctx.getBindModeHandler() &&
    (!ctx.getState().newElement || !arrow.startBinding || isOverlapping) &&
    !isAlreadyInsideBindingToSameElement
  ) {
    ctx.setBindModeHandler(setTimeout(effector, BIND_MODE_TIMEOUT));
  }

  ctx.setPreviousHoveredBindableElement(hoveredElement);
}
