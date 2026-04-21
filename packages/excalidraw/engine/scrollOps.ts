/**
 * scrollOps — scroll, zoom, and viewport operations extracted from App.tsx.
 *
 * Conversion pattern:
 *   BEFORE (App.tsx):  this.method(args)  → uses `this.state`, `this.setState`, etc.
 *   AFTER (here):      method(ctx, args)  → uses ctx.getState(), ctx.setState(), etc.
 *
 * Module-level globals from App.tsx (isPanning, isHoldingSpace, gesture,
 * currentScrollBars, lastPointerUp) are accessed via getter/setter on ctx so
 * these functions remain framework-agnostic.
 *
 * Phase 2a delegation status:
 *   Delegated in App.tsx:  zoomCanvas, translateCanvas, onScroll
 *   Deferred (later phase): scrollToContent, updateDOMRect, getCanvasOffsets,
 *                           resetShouldCacheIgnoreZoomDebounced,
 *                           handlePointerMoveOverScrollbars, handleWheel,
 *                           handleCanvasPanUsingWheelOrSpaceDrag
 *   (The deferred ones depend on module-level singletons or cross-module methods
 *    that will be wired up in a future phase.)
 */

import React from "react";

import {
  ZOOM_STEP,
  CURSOR_TYPE,
  EVENT,
  POINTER_BUTTON,
  debounce,
  easeToValuesRAF,
  easeOut,
  KEYS,
  CLASSES,
} from "@excalidraw/common";

import { isElementLink, parseElementLinkFromURL } from "@excalidraw/element";

import { isHandToolActive } from "../appState";

import { calculateScrollCenter, getNormalizedZoom } from "../scene";
import { getStateForZoom } from "../scene/zoom";
import { zoomToFit } from "../actions/actionCanvas";
import { setCursor, setCursorForShape } from "../cursor";
import { withBatchedUpdates, withBatchedUpdatesThrottled } from "../reactUtils";
import { t } from "../i18n";

import type { AppState, PointerDownState, Offsets } from "../types";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppEngineContext } from "./AppEngineContext";

// ---------------------------------------------------------------------------
// 1. zoomCanvas (line ~4281)
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
// 2. scrollToContent (line ~4302)
// ---------------------------------------------------------------------------

export function scrollToContent(
  ctx: AppEngineContext,
  target:
    | string
    | ExcalidrawElement
    | readonly ExcalidrawElement[] = ctx.scene.getNonDeletedElements(),
  opts?: (
    | {
        fitToContent?: boolean;
        fitToViewport?: never;
        viewportZoomFactor?: number;
        animate?: boolean;
        duration?: number;
      }
    | {
        fitToContent?: never;
        fitToViewport?: boolean;
        /** when fitToViewport=true, how much screen should the content cover,
         * between 0.1 (10%) and 1 (100%)
         */
        viewportZoomFactor?: number;
        animate?: boolean;
        duration?: number;
      }
  ) & {
    minZoom?: number;
    maxZoom?: number;
    canvasOffsets?: Offsets;
  },
): void {
  if (typeof target === "string") {
    let id: string | null;
    if (isElementLink(target)) {
      id = parseElementLinkFromURL(target);
    } else {
      id = target;
    }
    if (id) {
      const elements = ctx.scene.getElementsFromId(id);

      if (elements?.length) {
        scrollToContent(ctx, elements, {
          fitToContent: opts?.fitToContent ?? true,
          animate: opts?.animate ?? true,
        });
      } else if (isElementLink(target)) {
        ctx.setState({
          toast: {
            message: t("elementLink.notFound"),
            duration: 3000,
            closable: true,
          },
        });
      }
    }
    return;
  }

  ctx.cancelInProgressAnimation?.();

  // convert provided target into ExcalidrawElement[] if necessary
  const targetElements = Array.isArray(target) ? target : [target];

  const state = ctx.getState();
  let zoom = state.zoom;
  let scrollX = state.scrollX;
  let scrollY = state.scrollY;

  if (opts?.fitToContent || opts?.fitToViewport) {
    const { appState } = zoomToFit({
      canvasOffsets: opts.canvasOffsets,
      targetElements,
      appState: state,
      fitToViewport: !!opts?.fitToViewport,
      viewportZoomFactor: opts?.viewportZoomFactor,
      minZoom: opts?.minZoom,
      maxZoom: opts?.maxZoom,
    });
    zoom = appState.zoom;
    scrollX = appState.scrollX;
    scrollY = appState.scrollY;
  } else {
    // compute only the viewport location, without any zoom adjustment
    const scroll = calculateScrollCenter(targetElements, state);
    scrollX = scroll.scrollX;
    scrollY = scroll.scrollY;
  }

  // when animating, we use RequestAnimationFrame to prevent the animation
  // from slowing down other processes
  if (opts?.animate) {
    const currentState = ctx.getState();
    const origScrollX = currentState.scrollX;
    const origScrollY = currentState.scrollY;
    const origZoom = currentState.zoom.value;

    const cancel = easeToValuesRAF({
      fromValues: {
        scrollX: origScrollX,
        scrollY: origScrollY,
        zoom: origZoom,
      },
      toValues: { scrollX, scrollY, zoom: zoom.value },
      interpolateValue: (from, to, progress, key) => {
        // for zoom, use different easing
        if (key === "zoom") {
          return from * Math.pow(to / from, easeOut(progress));
        }
        // handle using default
        return undefined;
      },
      onStep: ({ scrollX, scrollY, zoom }) => {
        ctx.setState({
          scrollX,
          scrollY,
          zoom: { value: zoom },
        });
      },
      onStart: () => {
        ctx.setState({ shouldCacheIgnoreZoom: true });
      },
      onEnd: () => {
        ctx.setState({ shouldCacheIgnoreZoom: false });
      },
      onCancel: () => {
        ctx.setState({ shouldCacheIgnoreZoom: false });
      },
      duration: opts?.duration ?? 500,
    });

    ctx.setCancelInProgressAnimation(() => {
      cancel();
      ctx.setCancelInProgressAnimation(null);
    });
  } else {
    ctx.setState({ scrollX, scrollY, zoom });
  }
}

// ---------------------------------------------------------------------------
// 3. translateCanvas (line ~4451)
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
// 4. onScroll (line ~3543)
// ---------------------------------------------------------------------------

/**
 * Inner implementation for the debounced scroll handler.
 * Updates offsetTop/offsetLeft from the container's bounding rect.
 *
 * In App.tsx this is wrapped with debounce(SCROLL_TIMEOUT) at the call site.
 * Export is the plain function so the debounce instance stays per-component.
 */
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
// 5. updateDOMRect (line ~12721)
// ---------------------------------------------------------------------------

export function updateDOMRect(ctx: AppEngineContext, cb?: () => void): void {
  if (ctx.excalidrawContainerRef?.current) {
    const excalidrawContainer = ctx.excalidrawContainerRef.current;
    const {
      width,
      height,
      left: offsetLeft,
      top: offsetTop,
    } = excalidrawContainer.getBoundingClientRect();
    const {
      width: currentWidth,
      height: currentHeight,
      offsetTop: currentOffsetTop,
      offsetLeft: currentOffsetLeft,
    } = ctx.getState();

    if (
      width === currentWidth &&
      height === currentHeight &&
      offsetLeft === currentOffsetLeft &&
      offsetTop === currentOffsetTop
    ) {
      if (cb) {
        cb();
      }
      return;
    }

    ctx.setState(
      {
        width,
        height,
        offsetLeft,
        offsetTop,
      },
      () => {
        cb && cb();
      },
    );
  }
}

// ---------------------------------------------------------------------------
// 6. getCanvasOffsets (line ~12767)
// ---------------------------------------------------------------------------

export function getCanvasOffsets(
  ctx: AppEngineContext,
): Pick<AppState, "offsetTop" | "offsetLeft"> {
  if (ctx.excalidrawContainerRef?.current) {
    const excalidrawContainer = ctx.excalidrawContainerRef.current;
    const { left, top } = excalidrawContainer.getBoundingClientRect();
    return {
      offsetLeft: left,
      offsetTop: top,
    };
  }
  return {
    offsetLeft: 0,
    offsetTop: 0,
  };
}

// ---------------------------------------------------------------------------
// 7. resetShouldCacheIgnoreZoomDebounced (line ~12715)
// ---------------------------------------------------------------------------

export const resetShouldCacheIgnoreZoomDebounced = debounce(
  (ctx: AppEngineContext) => {
    // Note: unmounted check is at call site in App.tsx (this.unmounted guard)
    ctx.setState({ shouldCacheIgnoreZoom: false });
  },
  300,
);

// ---------------------------------------------------------------------------
// 8. handlePointerMoveOverScrollbars (line ~10352)
//
// NOTE: Phase 2a deferred. Depends on module-level `currentScrollBars`
// singleton from App.tsx, exposed via ctx.getCurrentScrollBars().
// ---------------------------------------------------------------------------

export function handlePointerMoveOverScrollbars(
  ctx: AppEngineContext,
  event: PointerEvent,
  pointerDownState: PointerDownState,
): boolean {
  const currentScrollBars = ctx.getCurrentScrollBars();
  const state = ctx.getState();

  if (pointerDownState.scrollbars.isOverHorizontal) {
    const x = event.clientX;
    const dx = x - pointerDownState.lastCoords.x;
    translateCanvas(ctx, {
      scrollX:
        state.scrollX -
        (dx * (currentScrollBars.horizontal?.deltaMultiplier || 1)) /
          state.zoom.value,
    });
    pointerDownState.lastCoords.x = x;
    return true;
  }

  if (pointerDownState.scrollbars.isOverVertical) {
    const y = event.clientY;
    const dy = y - pointerDownState.lastCoords.y;
    translateCanvas(ctx, {
      scrollY:
        state.scrollY -
        (dy * (currentScrollBars.vertical?.deltaMultiplier || 1)) /
          state.zoom.value,
    });
    pointerDownState.lastCoords.y = y;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 9. handleWheel (line ~12577)
//
// NOTE: Phase 2a deferred. Depends on module-level `isPanning` singleton
// from App.tsx, exposed via ctx.getIsPanning().
//
// withBatchedUpdates is NOT applied here because that utility requires a
// single-arg function. The caller (App.tsx) wraps with withBatchedUpdates
// when delegating.
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

      let newZoom = ctx.getState().zoom.value - delta / 100;
      // increase zoom steps the more zoomed-in we are (applies to >100% only)
      newZoom +=
        Math.log10(Math.max(1, ctx.getState().zoom.value)) *
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
// 10. handleCanvasPanUsingWheelOrSpaceDrag (line ~8045)
//
// NOTE: Phase 2a deferred. Depends on multiple module-level singletons from
// App.tsx (isPanning, isHoldingSpace, lastPointerUp, gesture), exposed via
// ctx getter/setter pairs.
// ---------------------------------------------------------------------------

export function handleCanvasPanUsingWheelOrSpaceDrag(
  ctx: AppEngineContext,
  event: React.PointerEvent<HTMLElement> | MouseEvent,
): boolean {
  const state = ctx.getState();
  const gesture = ctx.getGesture();

  if (
    !(
      gesture.pointers.size <= 1 &&
      (event.button === POINTER_BUTTON.WHEEL ||
        (event.button === POINTER_BUTTON.MAIN && ctx.getIsHoldingSpace()) ||
        isHandToolActive(state) ||
        (state.viewModeEnabled && state.activeTool.type !== "laser"))
    )
  ) {
    return false;
  }
  ctx.setIsPanning(true);

  // due to event.preventDefault below, container wouldn't get focus
  // automatically
  ctx.focusContainer();

  // preventing default while text editing messes with cursor/focus
  if (!state.editingTextElement) {
    // necessary to prevent browser from scrolling the page if excalidraw
    // not full-page #4489
    //
    // as such, the above is broken when panning canvas while in wysiwyg
    event.preventDefault();
  }

  let nextPastePrevented = false;
  const isLinux =
    typeof window === undefined
      ? false
      : /Linux/.test(window.navigator.platform);

  setCursor(ctx.interactiveCanvas, CURSOR_TYPE.GRABBING);
  let { clientX: lastX, clientY: lastY } = event;
  const onPointerMove = withBatchedUpdatesThrottled(
    (moveEvent: PointerEvent) => {
      const deltaX = lastX - moveEvent.clientX;
      const deltaY = lastY - moveEvent.clientY;
      lastX = moveEvent.clientX;
      lastY = moveEvent.clientY;

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
        const preventNextPaste = (pasteEvent: ClipboardEvent) => {
          document.body.removeEventListener(EVENT.PASTE, preventNextPaste);
          pasteEvent.stopPropagation();
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

      const currentState = ctx.getState();
      translateCanvas(ctx, {
        scrollX: currentState.scrollX - deltaX / currentState.zoom.value,
        scrollY: currentState.scrollY - deltaY / currentState.zoom.value,
      });
    },
  );

  // The teardown fn is stored in lastPointerUp (module global in App.tsx)
  // so it can be called from handleDraggingScrollBar cleanup. Here we use
  // ctx.setLastPointerUp/getLastPointerUp to replicate that pattern.
  const teardown: () => void = withBatchedUpdates(() => {
    ctx.setLastPointerUp(null);
    ctx.setIsPanning(false);
    const teardownState = ctx.getState();
    if (!ctx.getIsHoldingSpace()) {
      if (
        teardownState.viewModeEnabled &&
        teardownState.activeTool.type !== "laser"
      ) {
        setCursor(ctx.interactiveCanvas, CURSOR_TYPE.GRAB);
      } else {
        setCursorForShape(ctx.interactiveCanvas, teardownState);
      }
    }
    ctx.setState({
      cursorButton: "up",
    });
    ctx.savePointer(event.clientX, event.clientY, "up");
    window.removeEventListener(EVENT.POINTER_MOVE, onPointerMove);
    window.removeEventListener(EVENT.POINTER_UP, teardown);
    window.removeEventListener(EVENT.BLUR, teardown);
    onPointerMove.flush();
  });

  ctx.setLastPointerUp(teardown);
  window.addEventListener(EVENT.BLUR, teardown);
  window.addEventListener(EVENT.POINTER_MOVE, onPointerMove, {
    passive: true,
  });
  window.addEventListener(EVENT.POINTER_UP, teardown);
  return true;
}
