import { ROUNDNESS, assertNever } from "@sveltedraw/common";

import { pointsEqual } from "@sveltedraw/math";

import type { ElementOrToolType } from "@sveltedraw/engine/types";

import type { MarkNonNullable } from "@sveltedraw/common/utility-types";

import type {
  SveltedrawElement,
  SveltedrawTextElement,
  SveltedrawEmbeddableElement,
  SveltedrawLinearElement,
  SveltedrawBindableElement,
  SveltedrawFreeDrawElement,
  InitializedSveltedrawImageElement,
  SveltedrawImageElement,
  SveltedrawTextElementWithContainer,
  SveltedrawTextContainer,
  SveltedrawFrameElement,
  RoundnessType,
  SveltedrawFrameLikeElement,
  SveltedrawElementType,
  SveltedrawIframeElement,
  SveltedrawIframeLikeElement,
  SveltedrawMagicFrameElement,
  SveltedrawArrowElement,
  SveltedrawElbowArrowElement,
  SveltedrawLineElement,
  SveltedrawFlowchartNodeElement,
  SveltedrawLinearElementSubType,
} from "./types";

export const isInitializedImageElement = (
  element: SveltedrawElement | null,
): element is InitializedSveltedrawImageElement => {
  return !!element && element.type === "image" && !!element.fileId;
};

export const isImageElement = (
  element: SveltedrawElement | null,
): element is SveltedrawImageElement => {
  return !!element && element.type === "image";
};

export const isEmbeddableElement = (
  element: SveltedrawElement | null | undefined,
): element is SveltedrawEmbeddableElement => {
  return !!element && element.type === "embeddable";
};

export const isIframeElement = (
  element: SveltedrawElement | null,
): element is SveltedrawIframeElement => {
  return !!element && element.type === "iframe";
};

export const isIframeLikeElement = (
  element: SveltedrawElement | null,
): element is SveltedrawIframeLikeElement => {
  return (
    !!element && (element.type === "iframe" || element.type === "embeddable")
  );
};

export const isTextElement = (
  element: SveltedrawElement | null,
): element is SveltedrawTextElement => {
  return element != null && element.type === "text";
};

export const isFrameElement = (
  element: SveltedrawElement | null,
): element is SveltedrawFrameElement => {
  return element != null && element.type === "frame";
};

export const isMagicFrameElement = (
  element: SveltedrawElement | null,
): element is SveltedrawMagicFrameElement => {
  return element != null && element.type === "magicframe";
};

export const isFrameLikeElement = (
  element: SveltedrawElement | null,
): element is SveltedrawFrameLikeElement => {
  return (
    element != null &&
    (element.type === "frame" || element.type === "magicframe")
  );
};

export const isFreeDrawElement = (
  element?: SveltedrawElement | null,
): element is SveltedrawFreeDrawElement => {
  return element != null && isFreeDrawElementType(element.type);
};

export const isFreeDrawElementType = (
  elementType: SveltedrawElementType,
): boolean => {
  return elementType === "freedraw";
};

export const isLinearElement = (
  element?: SveltedrawElement | null,
): element is SveltedrawLinearElement => {
  return element != null && isLinearElementType(element.type);
};

export const isLineElement = (
  element?: SveltedrawElement | null,
): element is SveltedrawLineElement => {
  return element != null && element.type === "line";
};

export const isArrowElement = (
  element?: SveltedrawElement | null,
): element is SveltedrawArrowElement => {
  return element != null && element.type === "arrow";
};

export const isElbowArrow = (
  element?: SveltedrawElement,
): element is SveltedrawElbowArrowElement => {
  return isArrowElement(element) && element.elbowed;
};

/**
 * sharp or curved arrow, but not elbow
 */
export const isSimpleArrow = (
  element?: SveltedrawElement,
): element is SveltedrawArrowElement => {
  return isArrowElement(element) && !element.elbowed;
};

export const isSharpArrow = (
  element?: SveltedrawElement,
): element is SveltedrawArrowElement => {
  return isArrowElement(element) && !element.elbowed && !element.roundness;
};

export const isCurvedArrow = (
  element?: SveltedrawElement,
): element is SveltedrawArrowElement => {
  return (
    isArrowElement(element) && !element.elbowed && element.roundness !== null
  );
};

export const isLinearElementType = (
  elementType: ElementOrToolType,
): boolean => {
  return (
    elementType === "arrow" || elementType === "line" // || elementType === "freedraw"
  );
};

export const isBindingElement = (
  element?: SveltedrawElement | null,
  includeLocked = true,
): element is SveltedrawArrowElement => {
  return (
    element != null &&
    (!element.locked || includeLocked === true) &&
    isBindingElementType(element.type)
  );
};

export const isBindingElementType = (
  elementType: ElementOrToolType,
): boolean => {
  return elementType === "arrow";
};

export const isBindableElement = (
  element: SveltedrawElement | null | undefined,
  includeLocked = true,
): element is SveltedrawBindableElement => {
  return (
    element != null &&
    (!element.locked || includeLocked === true) &&
    (element.type === "rectangle" ||
      element.type === "diamond" ||
      element.type === "ellipse" ||
      element.type === "image" ||
      element.type === "iframe" ||
      element.type === "embeddable" ||
      element.type === "frame" ||
      element.type === "magicframe" ||
      (element.type === "text" && !element.containerId))
  );
};

export const isRectanguloidElement = (
  element?: SveltedrawElement | null,
): element is SveltedrawBindableElement => {
  return (
    element != null &&
    (element.type === "rectangle" ||
      element.type === "diamond" ||
      element.type === "image" ||
      element.type === "iframe" ||
      element.type === "embeddable" ||
      element.type === "frame" ||
      element.type === "magicframe" ||
      (element.type === "text" && !element.containerId))
  );
};

// TODO: Remove this when proper distance calculation is introduced
// @see binding.ts:distanceToBindableElement()
export const isRectangularElement = (
  element?: SveltedrawElement | null,
): element is SveltedrawBindableElement => {
  return (
    element != null &&
    (element.type === "rectangle" ||
      element.type === "image" ||
      element.type === "text" ||
      element.type === "iframe" ||
      element.type === "embeddable" ||
      element.type === "frame" ||
      element.type === "magicframe" ||
      element.type === "freedraw")
  );
};

export const isTextBindableContainer = (
  element: SveltedrawElement | null,
  includeLocked = true,
): element is SveltedrawTextContainer => {
  return (
    element != null &&
    (!element.locked || includeLocked === true) &&
    (element.type === "rectangle" ||
      element.type === "diamond" ||
      element.type === "ellipse" ||
      isArrowElement(element))
  );
};

export const isSveltedrawElement = (
  element: any,
): element is SveltedrawElement => {
  const type: SveltedrawElementType | undefined = element?.type;
  if (!type) {
    return false;
  }
  switch (type) {
    case "text":
    case "diamond":
    case "rectangle":
    case "iframe":
    case "embeddable":
    case "ellipse":
    case "arrow":
    case "freedraw":
    case "line":
    case "frame":
    case "magicframe":
    case "image":
    case "selection": {
      return true;
    }
    default: {
      assertNever(type, null);
      return false;
    }
  }
};

export const isFlowchartNodeElement = (
  element: SveltedrawElement,
): element is SveltedrawFlowchartNodeElement => {
  return (
    element.type === "rectangle" ||
    element.type === "ellipse" ||
    element.type === "diamond"
  );
};

export const hasBoundTextElement = (
  element: SveltedrawElement | null,
): element is MarkNonNullable<SveltedrawBindableElement, "boundElements"> => {
  return (
    isTextBindableContainer(element) &&
    !!element.boundElements?.some(({ type }) => type === "text")
  );
};

export const isBoundToContainer = (
  element: SveltedrawElement | null,
): element is SveltedrawTextElementWithContainer => {
  return (
    element !== null &&
    "containerId" in element &&
    element.containerId !== null &&
    isTextElement(element)
  );
};

export const isArrowBoundToElement = (element: SveltedrawArrowElement) => {
  return !!element.startBinding || !!element.endBinding;
};

export const isUsingAdaptiveRadius = (type: string) =>
  type === "rectangle" ||
  type === "embeddable" ||
  type === "iframe" ||
  type === "image";

export const isUsingProportionalRadius = (type: string) =>
  type === "line" || type === "arrow" || type === "diamond";

export const canApplyRoundnessTypeToElement = (
  roundnessType: RoundnessType,
  element: SveltedrawElement,
) => {
  if (
    (roundnessType === ROUNDNESS.ADAPTIVE_RADIUS ||
      // if legacy roundness, it can be applied to elements that currently
      // use adaptive radius
      roundnessType === ROUNDNESS.LEGACY) &&
    isUsingAdaptiveRadius(element.type)
  ) {
    return true;
  }
  if (
    roundnessType === ROUNDNESS.PROPORTIONAL_RADIUS &&
    isUsingProportionalRadius(element.type)
  ) {
    return true;
  }

  return false;
};

export const getDefaultRoundnessTypeForElement = (
  element: SveltedrawElement,
) => {
  if (isUsingProportionalRadius(element.type)) {
    return {
      type: ROUNDNESS.PROPORTIONAL_RADIUS,
    };
  }

  if (isUsingAdaptiveRadius(element.type)) {
    return {
      type: ROUNDNESS.ADAPTIVE_RADIUS,
    };
  }

  return null;
};

export const getLinearElementSubType = (
  element: SveltedrawLinearElement,
): SveltedrawLinearElementSubType => {
  if (isSharpArrow(element)) {
    return "sharpArrow";
  }
  if (isCurvedArrow(element)) {
    return "curvedArrow";
  }
  if (isElbowArrow(element)) {
    return "elbowArrow";
  }
  return "line";
};

/**
 * Checks if current element points meet all the conditions for polygon=true
 * (this isn't a element type check, for that use isLineElement).
 *
 * If you want to check if points *can* be turned into a polygon, use
 *  canBecomePolygon(points).
 */
export const isValidPolygon = (
  points: SveltedrawLineElement["points"],
): boolean => {
  return points.length > 3 && pointsEqual(points[0], points[points.length - 1]);
};

export const canBecomePolygon = (
  points: SveltedrawLineElement["points"],
): boolean => {
  return (
    points.length > 3 ||
    // 3-point polygons can't have all points in a single line
    (points.length === 3 && !pointsEqual(points[0], points[points.length - 1]))
  );
};
