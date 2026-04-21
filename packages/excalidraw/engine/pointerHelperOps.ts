import {
  KEYS,
  TOOL_TYPE,
  distance,
  getGridPoint,
  shouldMaintainAspectRatio,
  shouldResizeFromCenter,
  shouldRotateWithDiscreteAngle,
} from "@excalidraw/common";

import {
  cropElement,
  dragNewElement,
  getFrameChildren,
  getSelectedElements,
  getElementsInResizingFrame,
  isBindingElement,
  isElbowArrow,
  isFrameLikeElement,
  isImageElement,
  isInitializedImageElement,
  transformElements,
  updateBoundElements,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
} from "@excalidraw/element/types";

import {
  SnapCache,
  getReferenceSnapPoints,
  getVisibleGaps,
} from "../snapping";
import type { PointerDownState } from "../types";

import { translateCanvas } from "./scrollOps";

import type { AppEngineContext } from "./AppEngineContext";

export function handleEraser(
  ctx: AppEngineContext,
  event: PointerEvent,
  scenePointer: { x: number; y: number },
): void {
  const elementsToErase = ctx.eraserTrail.addPointToPath(
    scenePointer.x,
    scenePointer.y,
    event.altKey,
  );

  ctx.setElementsPendingErasure(new Set(elementsToErase));
  ctx.triggerRender();
}

export function handlePointerMoveOverScrollbars(
  ctx: AppEngineContext,
  event: PointerEvent,
  pointerDownState: PointerDownState,
): boolean {
  const currentScrollBars = ctx.getCurrentScrollBars();
  if (pointerDownState.scrollbars.isOverHorizontal) {
    const x = event.clientX;
    const dx = x - pointerDownState.lastCoords.x;
    translateCanvas(ctx, {
      scrollX:
        ctx.getState().scrollX -
        (dx * (currentScrollBars.horizontal?.deltaMultiplier || 1)) /
          ctx.getState().zoom.value,
    });
    pointerDownState.lastCoords.x = x;
    return true;
  }

  if (pointerDownState.scrollbars.isOverVertical) {
    const y = event.clientY;
    const dy = y - pointerDownState.lastCoords.y;
    translateCanvas(ctx, {
      scrollY:
        ctx.getState().scrollY -
        (dy * (currentScrollBars.vertical?.deltaMultiplier || 1)) /
          ctx.getState().zoom.value,
    });
    pointerDownState.lastCoords.y = y;
    return true;
  }
  return false;
}

export function maybeCacheReferenceSnapPoints(
  ctx: AppEngineContext,
  event: Parameters<AppEngineContext["isSnappingEnabled_facade"]>[0],
  selectedElements: ExcalidrawElement[],
  recomputeAnyways: boolean = false,
): void {
  if (
    ctx.isSnappingEnabled_facade(event, selectedElements) &&
    (recomputeAnyways || !SnapCache.getReferenceSnapPoints())
  ) {
    SnapCache.setReferenceSnapPoints(
      getReferenceSnapPoints(
        ctx.scene.getNonDeletedElements(),
        selectedElements,
        ctx.getState(),
        ctx.scene.getNonDeletedElementsMap(),
      ),
    );
  }
}

export function maybeCacheVisibleGaps(
  ctx: AppEngineContext,
  event: Parameters<AppEngineContext["isSnappingEnabled_facade"]>[0],
  selectedElements: ExcalidrawElement[],
  recomputeAnyways: boolean = false,
): void {
  if (
    ctx.isSnappingEnabled_facade(event, selectedElements) &&
    (recomputeAnyways || !SnapCache.getVisibleGaps())
  ) {
    SnapCache.setVisibleGaps(
      getVisibleGaps(
        ctx.scene.getNonDeletedElements(),
        selectedElements,
        ctx.getState(),
        ctx.scene.getNonDeletedElementsMap(),
      ),
    );
  }
}

export function maybeDragNewGenericElement(
  ctx: AppEngineContext,
  pointerDownState: PointerDownState,
  event: MouseEvent | KeyboardEvent,
  informMutation: boolean = true,
): void {
  const state = ctx.getState();
  const selectionElement = state.selectionElement;
  const pointerCoords = pointerDownState.lastCoords;
  if (
    selectionElement &&
    pointerDownState.boxSelection.hasOccurred &&
    state.activeTool.type !== "eraser"
  ) {
    dragNewElement({
      newElement: selectionElement,
      elementType: state.activeTool.type,
      originX: pointerDownState.origin.x,
      originY: pointerDownState.origin.y,
      x: pointerCoords.x,
      y: pointerCoords.y,
      width: distance(pointerDownState.origin.x, pointerCoords.x),
      height: distance(pointerDownState.origin.y, pointerCoords.y),
      shouldMaintainAspectRatio: shouldMaintainAspectRatio(event),
      shouldResizeFromCenter: false,
      scene: ctx.scene,
      zoom: state.zoom.value,
      informMutation: false,
    });
    return;
  }

  const newElement = state.newElement;
  if (!newElement) {
    return;
  }

  let [gridX, gridY] = getGridPoint(
    pointerCoords.x,
    pointerCoords.y,
    event[KEYS.CTRL_OR_CMD] ? null : ctx.getEffectiveGridSize(),
  );

  const image =
    isInitializedImageElement(newElement) &&
    ctx.imageCache.get(newElement.fileId)?.image;
  const aspectRatio =
    image && !(image instanceof Promise) ? image.width / image.height : null;

  maybeCacheReferenceSnapPoints(ctx, event, [newElement]);

  const { snapOffset, snapLines } = ctx.snapNewElement_facade(
    newElement,
    event,
    {
      x: pointerDownState.originInGrid.x + (state.originSnapOffset?.x ?? 0),
      y: pointerDownState.originInGrid.y + (state.originSnapOffset?.y ?? 0),
    },
    {
      x: gridX - pointerDownState.originInGrid.x,
      y: gridY - pointerDownState.originInGrid.y,
    },
  );

  gridX += snapOffset.x;
  gridY += snapOffset.y;

  ctx.setState({
    snapLines,
  });

  if (!isBindingElement(newElement)) {
    dragNewElement({
      newElement,
      elementType: state.activeTool.type,
      originX: pointerDownState.originInGrid.x,
      originY: pointerDownState.originInGrid.y,
      x: gridX,
      y: gridY,
      width: distance(pointerDownState.originInGrid.x, gridX),
      height: distance(pointerDownState.originInGrid.y, gridY),
      shouldMaintainAspectRatio: isImageElement(newElement)
        ? !shouldMaintainAspectRatio(event)
        : shouldMaintainAspectRatio(event),
      shouldResizeFromCenter: shouldResizeFromCenter(event),
      zoom: state.zoom.value,
      scene: ctx.scene,
      widthAspectRatio: aspectRatio,
      originOffset: state.originSnapOffset,
      informMutation,
    });
  }

  ctx.setState({
    newElement,
  });

  // highlight elements that are to be added to frames on frames creation
  if (
    ctx.getState().activeTool.type === TOOL_TYPE.frame ||
    ctx.getState().activeTool.type === TOOL_TYPE.magicframe
  ) {
    ctx.setState({
      elementsToHighlight: getElementsInResizingFrame(
        ctx.scene.getNonDeletedElements(),
        newElement as ExcalidrawFrameLikeElement,
        ctx.getState(),
        ctx.scene.getNonDeletedElementsMap(),
      ),
    });
  }
}

export function maybeHandleCrop(
  ctx: AppEngineContext,
  pointerDownState: PointerDownState,
  event: MouseEvent | KeyboardEvent,
): boolean {
  const state = ctx.getState();
  // to crop, we must already be in the cropping mode, where croppingElement has been set
  if (!state.croppingElementId) {
    return false;
  }

  const transformHandleType = pointerDownState.resize.handleType;
  const pointerCoords = pointerDownState.lastCoords;
  const [x, y] = getGridPoint(
    pointerCoords.x - pointerDownState.resize.offset.x,
    pointerCoords.y - pointerDownState.resize.offset.y,
    event[KEYS.CTRL_OR_CMD] ? null : ctx.getEffectiveGridSize(),
  );

  const croppingElement = ctx.scene
    .getNonDeletedElementsMap()
    .get(state.croppingElementId);

  if (
    transformHandleType &&
    croppingElement &&
    isImageElement(croppingElement)
  ) {
    const croppingAtStateStart = pointerDownState.originalElements.get(
      croppingElement.id,
    );

    const image =
      isInitializedImageElement(croppingElement) &&
      ctx.imageCache.get(croppingElement.fileId)?.image;

    if (
      croppingAtStateStart &&
      isImageElement(croppingAtStateStart) &&
      image &&
      !(image instanceof Promise)
    ) {
      const [gridX, gridY] = getGridPoint(
        pointerCoords.x,
        pointerCoords.y,
        event[KEYS.CTRL_OR_CMD] ? null : ctx.getEffectiveGridSize(),
      );

      const dragOffset = {
        x: gridX - pointerDownState.originInGrid.x,
        y: gridY - pointerDownState.originInGrid.y,
      };

      maybeCacheReferenceSnapPoints(ctx, event, [croppingElement]);

      const { snapOffset, snapLines } = ctx.snapResizingElements_facade(
        [croppingElement],
        [croppingAtStateStart],
        event,
        dragOffset,
        transformHandleType,
      );

      ctx.scene.mutateElement(
        croppingElement,
        cropElement(
          croppingElement,
          ctx.scene.getNonDeletedElementsMap(),
          transformHandleType,
          image.naturalWidth,
          image.naturalHeight,
          x + snapOffset.x,
          y + snapOffset.y,
          event.shiftKey
            ? croppingAtStateStart.width / croppingAtStateStart.height
            : undefined,
        ),
      );

      updateBoundElements(croppingElement, ctx.scene);

      ctx.setState({
        isCropping: transformHandleType && transformHandleType !== "rotation",
        snapLines,
      });
    }

    return true;
  }

  return false;
}

export function maybeHandleResize(
  ctx: AppEngineContext,
  pointerDownState: PointerDownState,
  event: MouseEvent | KeyboardEvent,
): boolean {
  const state = ctx.getState();
  const selectedElements = ctx.scene.getSelectedElements(state);
  const selectedFrames = selectedElements.filter(
    (element): element is ExcalidrawFrameLikeElement =>
      isFrameLikeElement(element),
  );

  const transformHandleType = pointerDownState.resize.handleType;

  if (
    // Frames cannot be rotated.
    (selectedFrames.length > 0 && transformHandleType === "rotation") ||
    // Elbow arrows cannot be transformed (resized or rotated).
    (selectedElements.length === 1 && isElbowArrow(selectedElements[0])) ||
    // Do not resize when in crop mode
    state.croppingElementId
  ) {
    return false;
  }

  ctx.setState({
    // TODO: rename this state field to "isScaling" to distinguish
    // it from the generic "isResizing" which includes scaling and
    // rotating
    isResizing: transformHandleType && transformHandleType !== "rotation",
    isRotating: transformHandleType === "rotation",
    activeEmbeddable: null,
  });
  const pointerCoords = pointerDownState.lastCoords;
  let [resizeX, resizeY] = getGridPoint(
    pointerCoords.x - pointerDownState.resize.offset.x,
    pointerCoords.y - pointerDownState.resize.offset.y,
    event[KEYS.CTRL_OR_CMD] ? null : ctx.getEffectiveGridSize(),
  );

  const frameElementsOffsetsMap = new Map<
    string,
    {
      x: number;
      y: number;
    }
  >();

  selectedFrames.forEach((frame) => {
    const elementsInFrame = getFrameChildren(
      ctx.scene.getNonDeletedElements(),
      frame.id,
    );

    elementsInFrame.forEach((element) => {
      frameElementsOffsetsMap.set(frame.id + element.id, {
        x: element.x - frame.x,
        y: element.y - frame.y,
      });
    });
  });

  // check needed for avoiding flickering when a key gets pressed
  // during dragging
  if (!ctx.getState().selectedElementsAreBeingDragged) {
    const [gridX, gridY] = getGridPoint(
      pointerCoords.x,
      pointerCoords.y,
      event[KEYS.CTRL_OR_CMD] ? null : ctx.getEffectiveGridSize(),
    );

    const dragOffset = {
      x: gridX - pointerDownState.originInGrid.x,
      y: gridY - pointerDownState.originInGrid.y,
    };

    const originalElements = [...pointerDownState.originalElements.values()];

    maybeCacheReferenceSnapPoints(ctx, event, selectedElements);

    const { snapOffset, snapLines } = ctx.snapResizingElements_facade(
      selectedElements,
      getSelectedElements(originalElements, ctx.getState()),
      event,
      dragOffset,
      transformHandleType,
    );

    resizeX += snapOffset.x;
    resizeY += snapOffset.y;

    ctx.setState({
      snapLines,
    });
  }

  if (
    transformElements(
      pointerDownState.originalElements,
      transformHandleType,
      selectedElements,
      ctx.scene,
      shouldRotateWithDiscreteAngle(event),
      shouldResizeFromCenter(event),
      selectedElements.some((element) => isImageElement(element))
        ? !shouldMaintainAspectRatio(event)
        : shouldMaintainAspectRatio(event),
      resizeX,
      resizeY,
      pointerDownState.resize.center.x,
      pointerDownState.resize.center.y,
    )
  ) {
    const elementsToHighlight = new Set<ExcalidrawElement>();
    selectedFrames.forEach((frame) => {
      getElementsInResizingFrame(
        ctx.scene.getNonDeletedElements(),
        frame,
        ctx.getState(),
        ctx.scene.getNonDeletedElementsMap(),
      ).forEach((element) => elementsToHighlight.add(element));
    });

    ctx.setState({
      elementsToHighlight: [...elementsToHighlight],
    });

    return true;
  }
  return false;
}
