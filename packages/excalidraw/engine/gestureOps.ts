/**
 * gestureOps — touch/gesture/pinch-zoom operations extracted from App.tsx.
 *
 * Conversion pattern:
 *   BEFORE (App.tsx):  this.method(args)  → uses `this.state`, `this.setState`, etc.
 *   AFTER (here):      method(ctx, args)  → uses ctx.getState(), ctx.setState(), etc.
 *
 * Module-level globals from App.tsx (didTapTwice, tappedTwiceTimer,
 * firstTapPosition, invalidateContextMenu, gesture) are accessed via
 * getter/setter on ctx so these functions remain framework-agnostic.
 *
 * Phase 2b delegation status:
 *   All 8 methods extracted:
 *     onGestureStart, onGestureChange, onGestureEnd,
 *     onTouchStart, onTouchEnd,
 *     isTouchScreenMultiTouchGesture, togglePenMode, handleTouchMove
 *
 * Note: withBatchedUpdates wrapping is kept at the App.tsx call site per the
 * scrollOps precedent.
 */

import React from "react";

import { pointFrom, pointDistance } from "@excalidraw/math";

import type { GestureEvent } from "../types";

import {
  TAP_TWICE_TIMEOUT,
  DOUBLE_TAP_POSITION_THRESHOLD,
  isIOS,
} from "@excalidraw/common";

import { makeNextSelectedElementIds } from "@excalidraw/element";

import { getNormalizedZoom } from "../scene";
import { getStateForZoom } from "../scene/zoom";

import type { AppEngineContext } from "./AppEngineContext";

// ---------------------------------------------------------------------------
// 1. isTouchScreenMultiTouchGesture (line ~5616)
// ---------------------------------------------------------------------------

/**
 * Returns whether user is making a gesture with >= 2 fingers (points)
 * on a touch screen (not on a trackpad). Currently only relates to Darwin
 * (iOS/iPadOS, MacOS), but may work on other devices in the future if
 * GestureEvent is standardized.
 */
export function isTouchScreenMultiTouchGesture(
  ctx: AppEngineContext,
): boolean {
  // we don't want to deselect when using trackpad, and multi-point gestures
  // only work on touch screens, so checking for >= pointers means we're on a
  // touchscreen
  return ctx.getGesture().pointers.size >= 2;
}

// ---------------------------------------------------------------------------
// 2. togglePenMode (line ~4302)
// ---------------------------------------------------------------------------

export function togglePenMode(
  ctx: AppEngineContext,
  force: boolean | null,
): void {
  ctx.setState((prevState) => {
    return {
      penMode: force ?? !prevState.penMode,
      penDetected: true,
    };
  });
}

// ---------------------------------------------------------------------------
// 3. onGestureStart (line ~5632) — fires only on Safari
// ---------------------------------------------------------------------------

export function onGestureStart(
  ctx: AppEngineContext,
  event: GestureEvent,
): void {
  event.preventDefault();

  // we only want to deselect on touch screens because user may have selected
  // elements by mistake while zooming
  if (isTouchScreenMultiTouchGesture(ctx)) {
    ctx.setState({
      selectedElementIds: makeNextSelectedElementIds({}, ctx.getState()),
      activeEmbeddable: null,
    });
  }
  ctx.getGesture().initialScale = ctx.getState().zoom.value;
}

// ---------------------------------------------------------------------------
// 4. onGestureChange (line ~5647) — fires only on Safari
// ---------------------------------------------------------------------------

export function onGestureChange(
  ctx: AppEngineContext,
  event: GestureEvent,
): void {
  event.preventDefault();

  // onGestureChange only has zoom factor but not the center.
  // If we're on iPad or iPhone, then we recognize multi-touch and will
  // zoom in at the right location in the touchmove handler
  // (handleCanvasPointerMove).
  //
  // On Macbook trackpad, we don't have those events so will zoom in at the
  // current location instead.
  //
  // As such, bail from this handler on touch devices.
  if (isTouchScreenMultiTouchGesture(ctx)) {
    return;
  }

  const initialScale = ctx.getGesture().initialScale;
  if (initialScale) {
    ctx.setState((state) => ({
      ...getStateForZoom(
        {
          viewportX: ctx.lastViewportPosition.x,
          viewportY: ctx.lastViewportPosition.y,
          nextZoom: getNormalizedZoom(initialScale * event.scale),
        },
        state,
      ),
    }));
  }
}

// ---------------------------------------------------------------------------
// 5. onGestureEnd (line ~5679) — fires only on Safari
// ---------------------------------------------------------------------------

export function onGestureEnd(
  ctx: AppEngineContext,
  event: GestureEvent,
): void {
  event.preventDefault();
  // reselect elements only on touch screens (see onGestureStart)
  if (isTouchScreenMultiTouchGesture(ctx)) {
    ctx.setState({
      previousSelectedElementIds: {},
      selectedElementIds: makeNextSelectedElementIds(
        ctx.getState().previousSelectedElementIds,
        ctx.getState(),
      ),
    });
  }
  ctx.getGesture().initialScale = null;
}

// ---------------------------------------------------------------------------
// 6. onTouchStart (line ~3621)
//
// App.resetTapTwice is a static that just resets didTapTwice and
// firstTapPosition. We expose those via ctx setters and inline the reset.
// ---------------------------------------------------------------------------

export function onTouchStart(
  ctx: AppEngineContext,
  event: TouchEvent,
): void {
  // fix for Apple Pencil Scribble (do not prevent for other devices)
  if (isIOS) {
    event.preventDefault();
  }

  if (!ctx.getDidTapTwice()) {
    ctx.setDidTapTwice(true);

    if (event.touches.length === 1) {
      ctx.setFirstTapPosition({
        x: event.touches[0]!.clientX,
        y: event.touches[0]!.clientY,
      });
    }
    clearTimeout(ctx.getTappedTwiceTimer());
    ctx.setTappedTwiceTimer(
      window.setTimeout(() => {
        // equivalent to App.resetTapTwice()
        ctx.setDidTapTwice(false);
        ctx.setFirstTapPosition(null);
      }, TAP_TWICE_TIMEOUT),
    );
    return;
  }

  // insert text only if we tapped twice with a single finger at approximately the same position
  // event.touches.length === 1 will also prevent inserting text when user's zooming
  const firstTapPosition = ctx.getFirstTapPosition();
  if (ctx.getDidTapTwice() && event.touches.length === 1 && firstTapPosition) {
    const touch = event.touches[0]!;
    const dist = pointDistance(
      pointFrom(touch.clientX, touch.clientY),
      pointFrom(firstTapPosition.x, firstTapPosition.y),
    );

    // only create text if the second tap is within the threshold of the first tap
    // this prevents accidental text creation during dragging/selection
    if (dist <= DOUBLE_TAP_POSITION_THRESHOLD) {
      // end lasso trail and deselect elements just in case
      ctx.lassoTrail.endPath();
      ctx.deselectElements();

      ctx.handleCanvasDoubleClick({
        clientX: touch.clientX,
        clientY: touch.clientY,
        type: "touch",
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      });
    }
    ctx.setDidTapTwice(false);
    clearTimeout(ctx.getTappedTwiceTimer());
  }

  if (event.touches.length === 2) {
    ctx.setState({
      selectedElementIds: makeNextSelectedElementIds({}, ctx.getState()),
      activeEmbeddable: null,
    });
  }
}

// ---------------------------------------------------------------------------
// 7. onTouchEnd (line ~3682)
// ---------------------------------------------------------------------------

export function onTouchEnd(
  ctx: AppEngineContext,
  event: TouchEvent,
): void {
  ctx.resetContextMenuTimer();
  const state = ctx.getState();
  if (event.touches.length > 0) {
    ctx.setState({
      previousSelectedElementIds: {},
      selectedElementIds: makeNextSelectedElementIds(
        state.previousSelectedElementIds,
        state,
      ),
    });
  } else {
    ctx.getGesture().pointers.clear();
  }
}

// ---------------------------------------------------------------------------
// 8. handleTouchMove (line ~7369)
// ---------------------------------------------------------------------------

export function handleTouchMove(
  ctx: AppEngineContext,
  _event: React.TouchEvent<HTMLCanvasElement>,
): void {
  ctx.setInvalidateContextMenu(true);
}
