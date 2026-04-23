// Smart Alignment & Guides system for Phase 13

export type AlignmentType =
  | "left"
  | "centerH"
  | "right"
  | "top"
  | "centerV"
  | "bottom";

export type DistributionType =
  | "distributeBetweenH"
  | "distributeBetweenV"
  | "distributeEvenlyH"
  | "distributeEvenlyV";

export interface AlignmentGuide {
  type: "vertical" | "horizontal";
  position: number;
  elements: string[]; // Element IDs that align
}

export interface Element {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
}

/**
 * Calculate alignment guides for selected elements
 * Returns guides where 2+ elements align
 */
export function calculateAlignmentGuides(
  elements: Element[],
  snapThreshold: number = 5,
): AlignmentGuide[] {
  if (elements.length < 2) return [];

  const guides: AlignmentGuide[] = [];

  // Check vertical alignment (left, center, right)
  const leftPositions = new Map<number, string[]>();
  const centerPositions = new Map<number, string[]>();
  const rightPositions = new Map<number, string[]>();

  for (const el of elements) {
    // Round to snap threshold
    const left = Math.round(el.x / snapThreshold) * snapThreshold;
    const center = Math.round((el.x + el.width / 2) / snapThreshold) * snapThreshold;
    const right = Math.round((el.x + el.width) / snapThreshold) * snapThreshold;

    addToMap(leftPositions, left, el.id);
    addToMap(centerPositions, center, el.id);
    addToMap(rightPositions, right, el.id);
  }

  // Add guides for aligned elements
  for (const [pos, ids] of leftPositions) {
    if (ids.length >= 2) guides.push({ type: "vertical", position: pos, elements: ids });
  }
  for (const [pos, ids] of centerPositions) {
    if (ids.length >= 2) guides.push({ type: "vertical", position: pos, elements: ids });
  }
  for (const [pos, ids] of rightPositions) {
    if (ids.length >= 2) guides.push({ type: "vertical", position: pos, elements: ids });
  }

  // Check horizontal alignment (top, center, bottom)
  const topPositions = new Map<number, string[]>();
  const midPositions = new Map<number, string[]>();
  const bottomPositions = new Map<number, string[]>();

  for (const el of elements) {
    const top = Math.round(el.y / snapThreshold) * snapThreshold;
    const mid = Math.round((el.y + el.height / 2) / snapThreshold) * snapThreshold;
    const bottom = Math.round((el.y + el.height) / snapThreshold) * snapThreshold;

    addToMap(topPositions, top, el.id);
    addToMap(midPositions, mid, el.id);
    addToMap(bottomPositions, bottom, el.id);
  }

  for (const [pos, ids] of topPositions) {
    if (ids.length >= 2) guides.push({ type: "horizontal", position: pos, elements: ids });
  }
  for (const [pos, ids] of midPositions) {
    if (ids.length >= 2) guides.push({ type: "horizontal", position: pos, elements: ids });
  }
  for (const [pos, ids] of bottomPositions) {
    if (ids.length >= 2) guides.push({ type: "horizontal", position: pos, elements: ids });
  }

  return guides;
}

/**
 * Align elements to a specific alignment type
 */
export function alignElements(
  elements: Element[],
  alignmentType: AlignmentType,
): Element[] {
  if (elements.length < 2) return elements;

  let targetValue = 0;

  // Calculate target value based on alignment type
  switch (alignmentType) {
    case "left":
      targetValue = Math.min(...elements.map(e => e.x));
      break;
    case "centerH":
      targetValue = elements.reduce((sum, e) => sum + e.x + e.width / 2, 0) / elements.length;
      break;
    case "right":
      targetValue = Math.max(...elements.map(e => e.x + e.width));
      break;
    case "top":
      targetValue = Math.min(...elements.map(e => e.y));
      break;
    case "centerV":
      targetValue = elements.reduce((sum, e) => sum + e.y + e.height / 2, 0) / elements.length;
      break;
    case "bottom":
      targetValue = Math.max(...elements.map(e => e.y + e.height));
      break;
  }

  // Apply alignment
  return elements.map(el => {
    const aligned = { ...el };
    switch (alignmentType) {
      case "left":
        aligned.x = targetValue;
        break;
      case "centerH":
        aligned.x = targetValue - el.width / 2;
        break;
      case "right":
        aligned.x = targetValue - el.width;
        break;
      case "top":
        aligned.y = targetValue;
        break;
      case "centerV":
        aligned.y = targetValue - el.height / 2;
        break;
      case "bottom":
        aligned.y = targetValue - el.height;
        break;
    }
    return aligned;
  });
}

/**
 * Distribute elements evenly
 */
export function distributeElements(
  elements: Element[],
  distributionType: DistributionType,
): Element[] {
  if (elements.length < 3) return elements;

  const sorted = [...elements];

  if (distributionType === "distributeBetweenH" || distributionType === "distributeEvenlyH") {
    sorted.sort((a, b) => a.x - b.x);

    const firstX = sorted[0].x;
    const lastX = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width;
    const totalSpace = lastX - firstX;
    const gaps = sorted.length - 1;
    const spacing = totalSpace / gaps;

    return sorted.map((el, i) => ({
      ...el,
      x: firstX + i * spacing - (i > 0 ? sorted[i].width / 2 : 0),
    }));
  } else {
    sorted.sort((a, b) => a.y - b.y);

    const firstY = sorted[0].y;
    const lastY = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height;
    const totalSpace = lastY - firstY;
    const gaps = sorted.length - 1;
    const spacing = totalSpace / gaps;

    return sorted.map((el, i) => ({
      ...el,
      y: firstY + i * spacing - (i > 0 ? sorted[i].height / 2 : 0),
    }));
  }
}

function addToMap<K>(map: Map<K, string[]>, key: K, id: string): void {
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key)!.push(id);
}
