import type React from "react";

import {
  CURSOR_TYPE,
  EVENT,
  KEYS,
  MIME_TYPES,
  getGridPoint,
  isSelectionLikeTool,
  isToolIcon,
  tupleToCoors,
  updateActiveTool,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import {
  StoreDelta,
  deepCopyElement,
  getCommonBounds,
  isElbowArrow,
  isElementInGroup,
  isLinearElementType,
  makeNextSelectedElementIds,
  normalizeSVG,
} from "@excalidraw/element";

import type { ApplyToOptions } from "@excalidraw/element";
import type { SceneElementsMap } from "@excalidraw/element/types";

import { appGlobals } from "./appGlobals";

import { dataURLToString, getDataURL_sync } from "../data/blob";
import { setCursor, setCursorForShape } from "../cursor";
import {
  withBatchedUpdates,
  withBatchedUpdatesThrottled,
} from "../reactUtils";
import { isOverScrollBars } from "../scene/scrollbars";
import { getCenter, getDistance } from "../gesture";

import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  CollaboratorPointer,
  PointerDownState,
  ToolType,
} from "../types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { AppEngineContext } from "./AppEngineContext";

export function resetHistory(ctx: AppEngineContext): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ctx.getApp() as any).history.clear();
}

export function resetStore(ctx: AppEngineContext): void {
  // store.clear is on the actual store, not on the engine context's `store`
  // (which is the public Store). Call via getApp.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ctx.getApp() as any).store.clear();
}

export function onUnload(ctx: AppEngineContext): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ctx.getApp() as any).onBlur();
}

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

export function addMissingFiles(
  ctx: AppEngineContext,
  files: BinaryFiles | BinaryFileData[],
  replace = false,
): { addedFiles: BinaryFiles } {
  const app = ctx.getApp();
  const nextFiles: BinaryFiles = replace ? {} : { ...app.files };
  const addedFiles: BinaryFiles = {};

  const _files = Array.isArray(files) ? files : Object.values(files);

  for (const fileData of _files) {
    if (nextFiles[fileData.id]) {
      continue;
    }

    addedFiles[fileData.id] = fileData;
    nextFiles[fileData.id] = fileData;

    if (fileData.mimeType === MIME_TYPES.svg) {
      try {
        const restoredDataURL = getDataURL_sync(
          normalizeSVG(dataURLToString(fileData.dataURL)),
          MIME_TYPES.svg,
        );
        if (fileData.dataURL !== restoredDataURL) {
          fileData.version = (fileData.version ?? 1) + 1;
          fileData.dataURL = restoredDataURL;
        }
      } catch (error) {
        console.error(error);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).files = nextFiles;

  return { addedFiles };
}

export function applyDeltas(
  ctx: AppEngineContext,
  deltas: StoreDelta[],
  options?: ApplyToOptions,
): [SceneElementsMap, AppState, boolean] {
  const aggregatedDelta = StoreDelta.squash(...deltas);

  const nextAppState = { ...ctx.getState() };
  const nextElements = new Map(
    ctx.scene.getElementsMapIncludingDeleted(),
  ) as SceneElementsMap;

  return StoreDelta.applyTo(
    aggregatedDelta,
    nextElements,
    nextAppState,
    options,
  );
}

export function setActiveTool(
  ctx: AppEngineContext,
  tool: ({ type: ToolType } | { type: "custom"; customType: string }) & {
    locked?: boolean;
    fromSelection?: boolean;
  },
  keepSelection = false,
): void {
  if (!ctx.isToolSupported(tool.type)) {
    console.warn(
      `"${tool.type}" tool is disabled via "UIOptions.canvasActions.tools.${tool.type}"`,
    );
    return;
  }

  const state = ctx.getState();
  const nextActiveTool = updateActiveTool(state, tool);
  if (nextActiveTool.type === "hand") {
    setCursor(ctx.interactiveCanvas, CURSOR_TYPE.GRAB);
  } else if (!appGlobals.isHoldingSpace) {
    setCursorForShape(ctx.interactiveCanvas, {
      ...state,
      activeTool: nextActiveTool,
    });
  }
  if (isToolIcon(document.activeElement)) {
    ctx.focusContainer();
  }
  if (!isLinearElementType(nextActiveTool.type)) {
    ctx.setState({ suggestedBinding: null });
  }
  if (nextActiveTool.type === "image") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ctx.getApp() as any).onImageToolbarButtonClick();
  }

  ctx.setState((prevState) => {
    const commonResets = {
      snapLines: prevState.snapLines.length ? [] : prevState.snapLines,
      originSnapOffset: null,
      activeEmbeddable: null,
      selectedLinearElement: isSelectionLikeTool(nextActiveTool.type)
        ? prevState.selectedLinearElement
        : null,
    } as const;

    if (nextActiveTool.type === "freedraw") {
      ctx.store.scheduleCapture();
    }

    if (nextActiveTool.type === "lasso") {
      return {
        ...prevState,
        ...commonResets,
        activeTool: nextActiveTool,
        ...(keepSelection
          ? {}
          : {
              selectedElementIds: makeNextSelectedElementIds({}, prevState),
              selectedGroupIds: makeNextSelectedElementIds({}, prevState),
              editingGroupId: null,
              multiElement: null,
            }),
      };
    } else if (nextActiveTool.type !== "selection") {
      return {
        ...prevState,
        ...commonResets,
        activeTool: nextActiveTool,
        selectedElementIds: makeNextSelectedElementIds({}, prevState),
        selectedGroupIds: makeNextSelectedElementIds({}, prevState),
        editingGroupId: null,
        multiElement: null,
      };
    }
    return {
      ...prevState,
      ...commonResets,
      activeTool: nextActiveTool,
    };
  });
}

export function deselectElements(ctx: AppEngineContext): void {
  ctx.setState({
    selectedElementIds: makeNextSelectedElementIds({}, ctx.getState()),
    selectedGroupIds: {},
    editingGroupId: null,
    activeEmbeddable: null,
  });
}
