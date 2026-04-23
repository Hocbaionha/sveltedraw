// Measurement & Dimensions system for Phase 13

export interface ElementDimensions {
  elementId: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface DistanceMeasurement {
  type: "distance";
  fromElement: string;
  toElement: string;
  distance: number;
  horizontalDistance: number;
  verticalDistance: number;
}

export interface Ruler {
  type: "horizontal" | "vertical";
  position: number;
  label?: string;
}

export interface MeasurementConfig {
  showRulers: boolean;
  showDistances: boolean;
  showDimensions: boolean;
  unit: "px" | "mm" | "cm" | "in";
  precision: number;
}

export interface Element {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  [key: string]: unknown;
}

/**
 * Get dimensions of an element
 */
export function getElementDimensions(element: Element): ElementDimensions {
  return {
    elementId: element.id,
    width: Math.round(element.width),
    height: Math.round(element.height),
    x: Math.round(element.x),
    y: Math.round(element.y),
  };
}

/**
 * Calculate distance between two elements (center to center)
 */
export function calculateDistance(
  element1: Element,
  element2: Element,
): DistanceMeasurement {
  const x1 = element1.x + element1.width / 2;
  const y1 = element1.y + element1.height / 2;
  const x2 = element2.x + element2.width / 2;
  const y2 = element2.y + element2.height / 2;

  const horizontalDistance = Math.abs(x2 - x1);
  const verticalDistance = Math.abs(y2 - y1);
  const distance = Math.sqrt(
    horizontalDistance * horizontalDistance + verticalDistance * verticalDistance,
  );

  return {
    type: "distance",
    fromElement: element1.id,
    toElement: element2.id,
    distance: Math.round(distance),
    horizontalDistance: Math.round(horizontalDistance),
    verticalDistance: Math.round(verticalDistance),
  };
}

/**
 * Calculate gap between two elements (closest edges)
 */
export function calculateGap(element1: Element, element2: Element): number {
  const el1Right = element1.x + element1.width;
  const el1Bottom = element1.y + element1.height;
  const el2Right = element2.x + element2.width;
  const el2Bottom = element2.y + element2.height;

  let gap = 0;

  // Check horizontal gap
  if (el1Right <= element2.x) {
    gap = element2.x - el1Right;
  } else if (el2Right <= element1.x) {
    gap = element1.x - el2Right;
  }

  // Check vertical gap
  if (el1Bottom <= element2.y && gap === 0) {
    gap = element2.y - el1Bottom;
  } else if (el2Bottom <= element1.y && gap === 0) {
    gap = element1.y - el2Bottom;
  }

  return Math.max(0, Math.round(gap));
}

/**
 * Convert pixels to another unit
 */
export function convertUnit(pixels: number, unit: "px" | "mm" | "cm" | "in"): number {
  const dpi = 96; // standard screen DPI
  const pxPerInch = dpi;
  const pxPerMm = dpi / 25.4;
  const pxPerCm = dpi / 2.54;

  switch (unit) {
    case "px":
      return pixels;
    case "mm":
      return pixels / pxPerMm;
    case "cm":
      return pixels / pxPerCm;
    case "in":
      return pixels / pxPerInch;
  }
}

/**
 * Format a measurement value with unit and precision
 */
export function formatMeasurement(
  value: number,
  unit: "px" | "mm" | "cm" | "in",
  precision: number = 1,
): string {
  const converted = convertUnit(value, unit);
  const rounded = Math.round(converted * Math.pow(10, precision)) / Math.pow(10, precision);

  switch (unit) {
    case "px":
      return `${rounded}px`;
    case "mm":
      return `${rounded}mm`;
    case "cm":
      return `${rounded}cm`;
    case "in":
      return `${rounded}"`;
  }
}

/**
 * Get measurement summary for selected elements
 */
export function getMeasurementSummary(
  elements: Element[],
  unit: "px" | "mm" | "cm" | "in" = "px",
) {
  if (elements.length === 0) {
    return null;
  }

  if (elements.length === 1) {
    const el = elements[0];
    const dims = getElementDimensions(el);
    return {
      count: 1,
      width: formatMeasurement(dims.width, unit),
      height: formatMeasurement(dims.height, unit),
      area: formatMeasurement(dims.width * dims.height, unit),
    };
  }

  // Calculate bounding box for multiple elements
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }

  const totalWidth = maxX - minX;
  const totalHeight = maxY - minY;

  return {
    count: elements.length,
    boundingWidth: formatMeasurement(totalWidth, unit),
    boundingHeight: formatMeasurement(totalHeight, unit),
    boundingArea: formatMeasurement(totalWidth * totalHeight, unit),
  };
}
