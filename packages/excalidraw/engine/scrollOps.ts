/**
 * scrollOps — scroll, zoom, and viewport operations extracted from App.tsx.
 *
 * Delegated in App.tsx: zoomCanvas, translateCanvas, onScroll,
 *   handleWheel, handleCanvasPanUsingWheelOrSpaceDrag.
 */

import type React from "react";

import { getNormalizedZoom } from "../scene";
import { getStateForZoom } from "../scene/zoom";
import {
  CLASSES,
  CURSOR_TYPE,
  EVENT,
  KEYS,
  POINTER_BUTTON,
  ZOOM_STEP,
} from "@excalidraw/common";
import { isHandToolActive } from "../appState";
import { setCursor, setCursorForShape } from "../cursor";
import { withBatchedUpdates, withBatchedUpdatesThrottled } from "../reactUtils";

import type { AppState } from "../types";
import type { AppEngineContext } from "./AppEngineContext";

// ---------------------------------------------------------------------------
// 1. zoomCanvas
// ---------------------------------------------------------------------------

/**
 * Zooms on canvas viewport center.
 * @param value Decimal fraction, auto-clamped between MIN_ZOOM and MAX_ZOOM.
 *   1 = 100% zoom, 2 = 200% zoom, 0.5 = 50% zoom
 */
export function zoomCanvas(ctx: AppEngineContext, value: number): void {
  const state = ctx.getState();
  ctx.setState({
    ...getStateForZoom(
      {
        viewportX: state.width / 2 + state.offsetLeft,
        viewportY: state.height / 2 + state.offsetTop,
        nextZoom: getNormalizedZoom(value),
      },
      state,
    ),
  });
}

// ---------------------------------------------------------------------------
// 2. translateCanvas
// ---------------------------------------------------------------------------

/** Use when changing scrollX/scrollY/zoom based on user interaction */
export function translateCanvas(
  ctx: AppEngineContext,
  state:
    | Partial<AppState>
    | ((prevState: AppState) => Partial<AppState> | null),
): void {
  ctx.cancelInProgressAnimation?.();
  ctx.maybeUnfollowRemoteUser();
  ctx.setState(state);
}

// ---------------------------------------------------------------------------
// 3. onScroll — inner implementation (App.tsx wraps with debounce)
// ---------------------------------------------------------------------------

export function onScroll(ctx: AppEngineContext): void {
  const { offsetTop, offsetLeft } = getCanvasOffsets(ctx);
  ctx.setState((state) => {
    if (state.offsetLeft === offsetLeft && state.offsetTop === offsetTop) {
      return null;
    }
    return { offsetTop, offsetLeft };
  });
}

// ---------------------------------------------------------------------------
// 4. handleWheel — inner function (App.tsx wraps with withBatchedUpdates)
// ---------------------------------------------------------------------------

export function handleWheel(
  ctx: AppEngineContext,
  event: WheelEvent | React.WheelEvent<HTMLDivElement | HTMLCanvasElement>,
): void {
  if (
    !(
      event.target instanceof HTMLCanvasElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLIFrameElement ||
      (event.target instanceof HTMLElement &&
        event.target.classList.contains(CLASSES.FRAME_NAME))
    )
  ) {
    // prevent zooming the browser (but allow scrolling DOM)
    if (event[KEYS.CTRL_OR_CMD]) {
      event.preventDefault();
    }
    return;
  }

  event.preventDefault();

  if (ctx.getIsPanning()) {
    return;
  }

  const { deltaX, deltaY } = event;
  // note that event.ctrlKey is necessary to handle pinch zooming
  if (event.metaKey || event.ctrlKey) {
    const sign = Math.sign(deltaY);
    const MAX_STEP = ZOOM_STEP * 100;
    const absDelta = Math.abs(deltaY);
    let delta = deltaY;
    if (absDelta > MAX_STEP) {
      delta = MAX_STEP * sign;
    }

    const state = ctx.getState();
    let newZoom = state.zoom.value - delta / 100;
    // increase zoom steps the more zoomed-in we are (applies to >100% only)
    newZoom +=
      Math.log10(Math.max(1, state.zoom.value)) *
      -sign *
      // reduced amplification for small deltas (small movements on a trackpad)
      Math.min(1, absDelta / 20);

    translateCanvas(ctx, (state) => ({
      ...getStateForZoom(
        {
          viewportX: ctx.lastViewportPosition.x,
          viewportY: ctx.lastViewportPosition.y,
          nextZoom: getNormalizedZoom(newZoom),
        },
        state,
      ),
      shouldCacheIgnoreZoom: true,
    }));
    ctx.resetShouldCacheIgnoreZoomDebounced();
    return;
  }

  // scroll horizontally when shift pressed
  if (event.shiftKey) {
    translateCanvas(ctx, ({ zoom, scrollX }) => ({
      // on Mac, shift+wheel tends to result in deltaX
      scrollX: scrollX - (deltaY || deltaX) / zoom.value,
    }));
    return;
  }

  translateCanvas(ctx, ({ zoom, scrollX, scrollY }) => ({
    scrollX: scrollX - deltaX / zoom.value,
    scrollY: scrollY - deltaY / zoom.value,
  }));
}

// ---------------------------------------------------------------------------
// 5. handleCanvasPanUsingWheelOrSpaceDrag
// ---------------------------------------------------------------------------

export function handleCanvasPanUsingWheelOrSpaceDrag(
  ctx: AppEngineContext,
  event: React.PointerEvent<HTMLElement> | MouseEvent,
): boolean {
  if (
    !(
      ctx.getGesture().pointers.size <= 1 &&
      (event.button === POINTER_BUTTON.WHEEL ||
        (event.button === POINTER_BUTTON.MAIN && ctx.getIsHoldingSpace()) ||
        isHandToolActive(ctx.getState()) ||
        (ctx.getState().viewModeEnabled &&
          ctx.getState().activeTool.type !== "laser"))
    )
  ) {
    return false;
  }
  ctx.setIsPanning(true);

  // due to event.preventDefault below, container wouldn't get focus
  // automatically
  ctx.focusContainer();

  // preventing default while text editing messes with cursor/focus
  if (!ctx.getState().editingTextElement) {
    // necessary to prevent browser from scrolling the page if excalidraw
    // not full-page #4489
    event.preventDefault();
  }

  let nextPastePrevented = false;
  const isLinux =
    typeof window === undefined
      ? false
      : /Linux/.test(window.navigator.platform);

  setCursor(ctx.interactiveCanvas, CURSOR_TYPE.GRABBING);
  let { clientX: lastX, clientY: lastY } = event;

  const onPointerMove = withBatchedUpdatesThrottled((event: PointerEvent) => {
    const deltaX = lastX - event.clientX;
    const deltaY = lastY - event.clientY;
    lastX = event.clientX;
    lastY = event.clientY;

    /*
     * Prevent paste event if we move while middle clicking on Linux.
     * See issue #1383.
     */
    if (
      isLinux &&
      !nextPastePrevented &&
      (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1)
    ) {
      nextPastePrevented = true;

      /* Prevent the next paste event */
      const preventNextPaste = (event: ClipboardEvent) => {
        document.body.removeEventListener(EVENT.PASTE, preventNextPaste);
        event.stopPropagation();
      };

      /*
       * Reenable next paste in case of disabled middle click paste for
       * any reason:
       * - right click paste
       * - empty clipboard
       */
      const enableNextPaste = () => {
        setTimeout(() => {
          document.body.removeEventListener(EVENT.PASTE, preventNextPaste);
          window.removeEventListener(EVENT.POINTER_UP, enableNextPaste);
        }, 100);
      };

      document.body.addEventListener(EVENT.PASTE, preventNextPaste);
      window.addEventListener(EVENT.POINTER_UP, enableNextPaste);
    }

    const state = ctx.getState();
    translateCanvas(ctx, {
      scrollX: state.scrollX - deltaX / state.zoom.value,
      scrollY: state.scrollY - deltaY / state.zoom.value,
    });
  });

  // rawTeardown is stored via ctx.setLastPointerUp so maybeCleanupAfterMissingPointerUp
  // can call it directly. teardown is the withBatchedUpdates-wrapped version used as
  // the event listener.
  const rawTeardown = () => {
    ctx.setLastPointerUp(null);
    ctx.setIsPanning(false);
    if (!ctx.getIsHoldingSpace()) {
      const state = ctx.getState();
      if (state.viewModeEnabled && state.activeTool.type !== "laser") {
        setCursor(ctx.interactiveCanvas, CURSOR_TYPE.GRAB);
      } else {
        setCursorForShape(ctx.interactiveCanvas, state);
      }
    }
    ctx.setState({ cursorButton: "up" });
    ctx.savePointer(event.clientX, event.clientY, "up");
    window.removeEventListener(EVENT.POINTER_MOVE, onPointerMove);
    window.removeEventListener(EVENT.POINTER_UP, teardown);
    window.removeEventListener(EVENT.BLUR, teardown);
    onPointerMove.flush();
  };
  ctx.setLastPointerUp(rawTeardown);
  const teardown = withBatchedUpdates(rawTeardown);

  window.addEventListener(EVENT.BLUR, teardown);
  window.addEventListener(EVENT.POINTER_MOVE, onPointerMove, {
    passive: true,
  });
  window.addEventListener(EVENT.POINTER_UP, teardown);
  return true;
}

// ---------------------------------------------------------------------------
// Internal helper (used by onScroll above)
// ---------------------------------------------------------------------------

function getCanvasOffsets(
  ctx: AppEngineContext,
): Pick<AppState, "offsetTop" | "offsetLeft"> {
  if (ctx.excalidrawContainerRef?.current) {
    const { left, top } =
      ctx.excalidrawContainerRef.current.getBoundingClientRect();
    return { offsetLeft: left, offsetTop: top };
  }
  return { offsetLeft: 0, offsetTop: 0 };
}
