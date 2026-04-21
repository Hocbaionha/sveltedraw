import {
  DEFAULT_COLLISION_THRESHOLD,
  DEFAULT_VERTICAL_ALIGN,
  TEXT_TO_CENTER_SNAP_THRESHOLD,
  VERTICAL_ALIGN,
  getFontString,
  getLineHeight,
  sceneCoordsToViewportCoords,
} from "@excalidraw/common";

import {
  getActiveTextElement,
  getApproxMinLineHeight,
  getApproxMinLineWidth,
  getBoundTextElement,
  getContainerCenter,
  getContainingFrame,
  getElementAbsoluteCoords,
  getLineHeightInPx,
  hasBoundingBox,
  hitElementBoundText,
  hitElementBoundingBox,
  hitElementItself,
  isArrowElement,
  isCursorInFrame,
  isFrameLikeElement,
  isIframeElement,
  isTextBindableContainer,
  isTextElement,
  isValidTextContainer,
  newTextElement,
} from "@excalidraw/element";

import { pointFrom } from "@excalidraw/math";
import type { Radians } from "@excalidraw/math";

import { actionTextAutoResize } from "../actions/actionTextAutoResize";
import { isPointHittingTextAutoResizeHandle } from "../textAutoResizeHandle";

import type { AppState } from "../types";
import type {
  ExcalidrawElement,
  ExcalidrawIframeElement,
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
  Ordered,
} from "@excalidraw/element/types";

import type { AppEngineContext } from "./AppEngineContext";

export function getTextCreationGridPoint(
  ctx: AppEngineContext,
  x: number,
  y: number,
): { x: number; y: number } | null {
  const effectiveGridSize = ctx.getEffectiveGridSize();

  if (effectiveGridSize === null) {
    return null;
  }

  const getCoord = (coordinate: number) =>
    Math.floor(coordinate / effectiveGridSize) * effectiveGridSize;

  return { x: getCoord(x), y: getCoord(y) };
}

export function getTextWysiwygSnappedToCenterPosition(
  ctx: AppEngineContext,
  x: number,
  y: number,
  appState: AppState,
  container?: ExcalidrawTextContainer | null,
):
  | {
      viewportX: number;
      viewportY: number;
      elementCenterX: number;
      elementCenterY: number;
    }
  | undefined {
  if (container) {
    let elementCenterX = container.x + container.width / 2;
    let elementCenterY = container.y + container.height / 2;

    const elementCenter = getContainerCenter(
      container,
      appState,
      ctx.scene.getNonDeletedElementsMap(),
    );
    if (elementCenter) {
      elementCenterX = elementCenter.x;
      elementCenterY = elementCenter.y;
    }
    const distanceToCenter = Math.hypot(
      x - elementCenterX,
      y - elementCenterY,
    );
    const isSnappedToCenter =
      distanceToCenter < TEXT_TO_CENTER_SNAP_THRESHOLD;
    if (isSnappedToCenter) {
      const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
        { sceneX: elementCenterX, sceneY: elementCenterY },
        appState,
      );
      return { viewportX, viewportY, elementCenterX, elementCenterY };
    }
  }
  return undefined;
}

export function getSelectedTextElement(
  ctx: AppEngineContext,
  container?: ExcalidrawTextContainer | null,
): NonDeleted<ExcalidrawTextElement> | null {
  const selectedElements = ctx.scene.getSelectedElements(ctx.getState());

  if (selectedElements.length !== 1) {
    return null;
  }

  const selectedElement = selectedElements[0]!;

  if (isTextElement(selectedElement)) {
    return selectedElement;
  }

  if (!container) {
    return null;
  }

  return getBoundTextElement(
    selectedElement,
    ctx.scene.getNonDeletedElementsMap(),
  );
}

export function getTextElementAtPosition(
  ctx: AppEngineContext,
  x: number,
  y: number,
): NonDeleted<ExcalidrawTextElement> | null {
  const element = ctx.getElementAtPosition(x, y, {
    includeBoundTextElement: true,
  });
  if (element && isTextElement(element) && !element.isDeleted) {
    return element;
  }
  return null;
}

export function getSelectedTextEditingContainerAtPosition(
  ctx: AppEngineContext,
  hitElement: NonDeletedExcalidrawElement | null,
  sceneCoords: { x: number; y: number },
): ExcalidrawTextContainer | null | undefined {
  const selectedElements = ctx.scene.getSelectedElements(ctx.getState());

  if (
    selectedElements.length !== 1 ||
    !hitElement ||
    hitElement.id !== selectedElements[0]!.id
  ) {
    return null;
  }

  const selectedElement = selectedElements[0]!;

  if (isTextElement(selectedElement)) {
    return null;
  }

  if (!isValidTextContainer(selectedElement)) {
    return undefined;
  }

  const textElement = getSelectedTextElement(ctx, selectedElement);
  const hitTextElement = getTextElementAtPosition(
    ctx,
    sceneCoords.x,
    sceneCoords.y,
  );

  if (!textElement || hitTextElement?.id !== textElement.id) {
    return undefined;
  }

  return selectedElement;
}

export function getTextBindableContainerAtPosition(
  ctx: AppEngineContext,
  x: number,
  y: number,
): ExcalidrawTextContainer | null {
  const elements = ctx.scene.getNonDeletedElements();
  const selectedElements = ctx.scene.getSelectedElements(ctx.getState());
  if (selectedElements.length === 1) {
    return isTextBindableContainer(selectedElements[0], false)
      ? (selectedElements[0] as ExcalidrawTextContainer)
      : null;
  }
  let hitElement: ExcalidrawElement | null = null;
  for (let index = elements.length - 1; index >= 0; --index) {
    if (elements[index].isDeleted) {
      continue;
    }
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(
      elements[index],
      ctx.scene.getNonDeletedElementsMap(),
    );
    if (
      isArrowElement(elements[index]) &&
      hitElementItself({
        point: pointFrom(x, y),
        element: elements[index],
        elementsMap: ctx.scene.getNonDeletedElementsMap(),
        threshold: getElementHitThreshold(ctx, elements[index]),
      })
    ) {
      hitElement = elements[index];
      break;
    } else if (x1 < x && x < x2 && y1 < y && y < y2) {
      hitElement = elements[index];
      break;
    }
  }

  return isTextBindableContainer(hitElement, false)
    ? (hitElement as ExcalidrawTextContainer)
    : null;
}

export function isHittingTextAutoResizeHandle(
  ctx: AppEngineContext,
  selectedElements: NonDeleted<ExcalidrawElement>[],
  point: Readonly<{ x: number; y: number }>,
): boolean {
  const activeTextElement = getActiveTextElement(
    selectedElements,
    ctx.getState(),
  );

  if (
    activeTextElement &&
    !activeTextElement.isDeleted &&
    !activeTextElement.autoResize &&
    isPointHittingTextAutoResizeHandle(
      point,
      activeTextElement,
      ctx.getState().zoom.value,
      ctx.editorInterface.formFactor,
    )
  ) {
    return true;
  }

  return false;
}

export function handleTextAutoResizeHandlePointerDown(
  ctx: AppEngineContext,
  selectedElements: NonDeleted<ExcalidrawElement>[],
  point: Readonly<{ x: number; y: number }>,
): boolean {
  const activeTextElement = getActiveTextElement(
    selectedElements,
    ctx.getState(),
  );
  if (
    !activeTextElement ||
    !isHittingTextAutoResizeHandle(ctx, selectedElements, point)
  ) {
    return false;
  }

  ctx.actionManager.executeAction(
    actionTextAutoResize,
    "ui",
    activeTextElement,
  );
  ctx.appResetCursor();
  return true;
}

export function getElementsAtPosition(
  ctx: AppEngineContext,
  x: number,
  y: number,
  opts?: {
    includeBoundTextElement?: boolean;
    includeLockedElements?: boolean;
  },
): NonDeleted<ExcalidrawElement>[] {
  const iframeLikes: Ordered<ExcalidrawIframeElement>[] = [];

  const elementsMap = ctx.scene.getNonDeletedElementsMap();

  const elements = (
    opts?.includeBoundTextElement && opts?.includeLockedElements
      ? ctx.scene.getNonDeletedElements()
      : ctx.scene
          .getNonDeletedElements()
          .filter(
            (element) =>
              (opts?.includeLockedElements || !element.locked) &&
              (opts?.includeBoundTextElement ||
                !(isTextElement(element) && element.containerId)),
          )
  )
    .filter((el) => hitElement(ctx, x, y, el))
    .filter((element) => {
      const containingFrame = getContainingFrame(element, elementsMap);
      return containingFrame &&
        ctx.getState().frameRendering.enabled &&
        ctx.getState().frameRendering.clip
        ? isCursorInFrame({ x, y }, containingFrame, elementsMap)
        : true;
    })
    .filter((el) => {
      if (isIframeElement(el)) {
        iframeLikes.push(el);
        return false;
      }
      return true;
    })
    .concat(iframeLikes) as NonDeleted<ExcalidrawElement>[];

  return elements;
}

export function getElementHitThreshold(
  ctx: AppEngineContext,
  element: ExcalidrawElement,
): number {
  return Math.max(
    element.strokeWidth / 2 + 0.1,
    0.85 * (DEFAULT_COLLISION_THRESHOLD / ctx.getState().zoom.value),
  );
}

export function hitElement(
  ctx: AppEngineContext,
  x: number,
  y: number,
  element: ExcalidrawElement,
  considerBoundingBox = true,
): boolean {
  if (
    considerBoundingBox &&
    ctx.getState().selectedElementIds[element.id] &&
    hasBoundingBox([element], ctx.getState(), ctx.editorInterface)
  ) {
    if (
      hitElementBoundingBox(
        pointFrom(x, y),
        element,
        ctx.scene.getNonDeletedElementsMap(),
        getElementHitThreshold(ctx, element),
      )
    ) {
      return true;
    }
  }

  const hitBoundTextOfElement = hitElementBoundText(
    pointFrom(x, y),
    element,
    ctx.scene.getNonDeletedElementsMap(),
  );
  if (hitBoundTextOfElement) {
    return true;
  }

  return hitElementItself({
    point: pointFrom(x, y),
    element,
    threshold: getElementHitThreshold(ctx, element),
    elementsMap: ctx.scene.getNonDeletedElementsMap(),
    frameNameBound: isFrameLikeElement(element)
      ? ctx.frameNameBoundsCache.get(element)
      : null,
  });
}

export function getElementAtPosition(
  ctx: AppEngineContext,
  x: number,
  y: number,
  opts?: (
    | {
        includeBoundTextElement?: boolean;
        includeLockedElements?: boolean;
      }
    | {
        allHitElements: NonDeleted<ExcalidrawElement>[];
      }
  ) & {
    preferSelected?: boolean;
  },
): NonDeleted<ExcalidrawElement> | null {
  let allHitElements: NonDeleted<ExcalidrawElement>[] = [];
  if (opts && "allHitElements" in opts) {
    allHitElements = opts?.allHitElements || [];
  } else {
    allHitElements = getElementsAtPosition(ctx, x, y, {
      includeBoundTextElement: opts?.includeBoundTextElement,
      includeLockedElements: opts?.includeLockedElements,
    });
  }

  if (allHitElements.length > 1) {
    if (opts?.preferSelected) {
      for (let index = allHitElements.length - 1; index > -1; index--) {
        if (ctx.getState().selectedElementIds[allHitElements[index].id]) {
          return allHitElements[index];
        }
      }
    }
    const elementWithHighestZIndex =
      allHitElements[allHitElements.length - 1];

    return hitElementItself({
      point: pointFrom(x, y),
      element: elementWithHighestZIndex,
      threshold: getElementHitThreshold(ctx, elementWithHighestZIndex) / 2,
      elementsMap: ctx.scene.getNonDeletedElementsMap(),
      frameNameBound: isFrameLikeElement(elementWithHighestZIndex)
        ? ctx.frameNameBoundsCache.get(elementWithHighestZIndex)
        : null,
    })
      ? elementWithHighestZIndex
      : allHitElements[allHitElements.length - 2];
  }
  if (allHitElements.length === 1) {
    return allHitElements[0];
  }

  return null;
}

export function startTextEditing(
  ctx: AppEngineContext,
  {
    sceneX,
    sceneY,
    insertAtParentCenter = true,
    container,
    autoEdit = true,
    initialCaretSceneCoords,
  }: {
    sceneX: number;
    sceneY: number;
    insertAtParentCenter?: boolean;
    container?: ExcalidrawTextContainer | null;
    autoEdit?: boolean;
    initialCaretSceneCoords?: { x: number; y: number };
  },
): void {
  let shouldBindToContainer = false;
  let mutSceneX = sceneX;
  let mutSceneY = sceneY;

  let parentCenterPosition =
    insertAtParentCenter &&
    getTextWysiwygSnappedToCenterPosition(
      ctx,
      mutSceneX,
      mutSceneY,
      ctx.getState(),
      container,
    );
  if (container && parentCenterPosition) {
    const boundTextElementToContainer = getBoundTextElement(
      container,
      ctx.scene.getNonDeletedElementsMap(),
    );
    if (!boundTextElementToContainer) {
      shouldBindToContainer = true;
    }
  }
  const existingTextElement =
    getSelectedTextElement(ctx, container) ||
    getTextElementAtPosition(ctx, mutSceneX, mutSceneY);

  const fontFamily =
    existingTextElement?.fontFamily || ctx.getState().currentItemFontFamily;

  const lineHeight =
    existingTextElement?.lineHeight || getLineHeight(fontFamily);
  const fontSize = ctx.getState().currentItemFontSize;

  if (
    !existingTextElement &&
    shouldBindToContainer &&
    container &&
    !isArrowElement(container)
  ) {
    const fontString = {
      fontSize,
      fontFamily,
    };
    const minWidth = getApproxMinLineWidth(
      getFontString(fontString),
      lineHeight,
    );
    const minHeight = getApproxMinLineHeight(fontSize, lineHeight);
    const newHeight = Math.max(container.height, minHeight);
    const newWidth = Math.max(container.width, minWidth);
    ctx.scene.mutateElement(container, {
      height: newHeight,
      width: newWidth,
    });
    mutSceneX = container.x + newWidth / 2;
    mutSceneY = container.y + newHeight / 2;
    if (parentCenterPosition) {
      parentCenterPosition = getTextWysiwygSnappedToCenterPosition(
        ctx,
        mutSceneX,
        mutSceneY,
        ctx.getState(),
        container,
      );
    }
  }

  const topLayerFrame = ctx.getTopLayerFrameAtSceneCoords({
    x: mutSceneX,
    y: mutSceneY,
  });

  const textCreationGridPoint = getTextCreationGridPoint(ctx, mutSceneX, mutSceneY);

  const newTextElementPosition = parentCenterPosition
    ? {
        x: parentCenterPosition.elementCenterX,
        y: parentCenterPosition.elementCenterY,
      }
    : !existingTextElement
    ? {
        x: textCreationGridPoint?.x ?? mutSceneX,
        y:
          textCreationGridPoint === null
            ? mutSceneY - getLineHeightInPx(fontSize, lineHeight) / 2
            : textCreationGridPoint.y,
      }
    : {
        x: mutSceneX,
        y: mutSceneY,
      };

  const state = ctx.getState();
  const element =
    existingTextElement ||
    newTextElement({
      x: newTextElementPosition.x,
      y: newTextElementPosition.y,
      strokeColor: state.currentItemStrokeColor,
      backgroundColor: state.currentItemBackgroundColor,
      fillStyle: state.currentItemFillStyle,
      strokeWidth: state.currentItemStrokeWidth,
      strokeStyle: state.currentItemStrokeStyle,
      roughness: state.currentItemRoughness,
      opacity: state.currentItemOpacity,
      text: "",
      fontSize,
      fontFamily,
      textAlign: parentCenterPosition
        ? "center"
        : state.currentItemTextAlign,
      verticalAlign: parentCenterPosition
        ? VERTICAL_ALIGN.MIDDLE
        : DEFAULT_VERTICAL_ALIGN,
      containerId: shouldBindToContainer ? container?.id : undefined,
      groupIds: container?.groupIds ?? [],
      lineHeight,
      angle: container
        ? isArrowElement(container)
          ? (0 as Radians)
          : container.angle
        : (0 as Radians),
      frameId: topLayerFrame ? topLayerFrame.id : null,
    });

  if (!existingTextElement && shouldBindToContainer && container) {
    ctx.scene.mutateElement(container, {
      boundElements: (container.boundElements || []).concat({
        type: "text",
        id: element.id,
      }),
    });
  }
  ctx.setState({ editingTextElement: element });

  if (!existingTextElement) {
    if (container && shouldBindToContainer) {
      const containerIndex = ctx.scene.getElementIndex(container.id);
      ctx.scene.insertElementAtIndex(element, containerIndex + 1);
    } else {
      ctx.scene.insertElement(element);
    }
  }

  if (autoEdit || existingTextElement || container) {
    ctx.handleTextWysiwyg(element, {
      isExistingElement: !!existingTextElement,
      initialCaretSceneCoords: existingTextElement
        ? initialCaretSceneCoords
        : null,
    });
  } else {
    ctx.setState({
      newElement: element,
      multiElement: null,
    });
  }
}
