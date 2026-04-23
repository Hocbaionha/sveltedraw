// Auto-Layout Algorithm system for Phase 13

export type LayoutType = "flowchart" | "orgchart" | "grid" | "circular" | "tree";

export interface LayoutConfig {
  type: LayoutType;
  direction: "horizontal" | "vertical";
  spacing: {
    horizontal: number;
    vertical: number;
  };
  alignment: "start" | "center" | "end";
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

export interface LayoutResult {
  elementId: string;
  x: number;
  y: number;
}

/**
 * Arrange elements in a grid pattern
 */
export function gridLayout(
  elements: Element[],
  config: { columns?: number; spacing: { horizontal: number; vertical: number } },
): LayoutResult[] {
  if (elements.length === 0) return [];

  const columns = config.columns || Math.ceil(Math.sqrt(elements.length));
  const spacing = config.spacing;

  // Sort by current position to maintain some semblance of order
  const sorted = [...elements].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 10) return a.y - b.y;
    return a.x - b.x;
  });

  return sorted.map((el, i) => {
    const row = Math.floor(i / columns);
    const col = i % columns;

    return {
      elementId: el.id,
      x: col * (el.width + spacing.horizontal),
      y: row * (el.height + spacing.vertical),
    };
  });
}

/**
 * Arrange elements in a circular pattern
 */
export function circularLayout(
  elements: Element[],
  config: { radius?: number; center?: { x: number; y: number } },
): LayoutResult[] {
  if (elements.length === 0) return [];

  const radius = config.radius || 200;
  const center = config.center || { x: 400, y: 300 };
  const angleStep = (2 * Math.PI) / elements.length;

  return elements.map((el, i) => {
    const angle = i * angleStep;
    const x = center.x + radius * Math.cos(angle) - el.width / 2;
    const y = center.y + radius * Math.sin(angle) - el.height / 2;

    return {
      elementId: el.id,
      x: Math.round(x),
      y: Math.round(y),
    };
  });
}

/**
 * Arrange elements in a flowchart pattern (top-down or left-right)
 */
export function flowchartLayout(
  elements: Element[],
  config: {
    direction: "vertical" | "horizontal";
    spacing: { horizontal: number; vertical: number };
    alignment: "start" | "center" | "end";
  },
): LayoutResult[] {
  if (elements.length === 0) return [];

  const spacing = config.spacing;
  const results: LayoutResult[] = [];
  let currentX = 0;
  let currentY = 0;
  let maxHeight = 0;
  let maxWidth = 0;

  if (config.direction === "vertical") {
    // Top-down flowchart
    for (const el of elements) {
      const x = config.alignment === "center" ? 300 - el.width / 2 :
               config.alignment === "end" ? 600 - el.width : 0;

      results.push({
        elementId: el.id,
        x,
        y: currentY,
      });

      currentY += el.height + spacing.vertical;
      maxWidth = Math.max(maxWidth, el.width);
    }
  } else {
    // Left-right flowchart
    for (const el of elements) {
      const y = config.alignment === "center" ? 250 - el.height / 2 :
               config.alignment === "end" ? 500 - el.height : 0;

      results.push({
        elementId: el.id,
        x: currentX,
        y,
      });

      currentX += el.width + spacing.horizontal;
      maxHeight = Math.max(maxHeight, el.height);
    }
  }

  return results;
}

/**
 * Arrange elements as a hierarchical tree (org chart style)
 */
export function treelayerLayout(
  elements: Element[],
  config: {
    direction: "vertical" | "horizontal";
    spacing: { horizontal: number; vertical: number };
    rootIndex?: number;
  },
): LayoutResult[] {
  if (elements.length === 0) return [];

  const spacing = config.spacing;
  const rootIndex = config.rootIndex || 0;
  const results: LayoutResult[] = [];

  // Simple tree layout: arrange first element at top, then subsequent elements in layers
  const root = elements[rootIndex];
  results.push({
    elementId: root.id,
    x: 300 - root.width / 2,
    y: 0,
  });

  if (elements.length === 1) return results;

  // Group remaining elements into layers
  const childCount = Math.ceil(Math.sqrt(elements.length - 1));
  let childX = 0;
  let childY = root.height + spacing.vertical;
  let elementsInRow = 0;

  for (let i = 0; i < elements.length; i++) {
    if (i === rootIndex) continue;

    const el = elements[i];
    const maxWidth = 600; // Assume viewport width
    const totalChildWidth = childCount * (el.width + spacing.horizontal);
    const startX = Math.max(0, Math.min(childX, maxWidth - el.width));

    results.push({
      elementId: el.id,
      x: startX,
      y: childY,
    });

    childX += el.width + spacing.horizontal;
    elementsInRow++;

    if (elementsInRow >= childCount) {
      childX = 0;
      childY += el.height + spacing.vertical;
      elementsInRow = 0;
    }
  }

  return results;
}

/**
 * Apply layout results to elements
 */
export function applyLayout(
  elements: Element[],
  layoutResults: LayoutResult[],
): Element[] {
  const resultMap = new Map(layoutResults.map(r => [r.elementId, r]));

  return elements.map(el => {
    const layout = resultMap.get(el.id);
    if (!layout) return el;

    return {
      ...el,
      x: layout.x,
      y: layout.y,
    };
  });
}

/**
 * Calculate layout for elements based on config
 */
export function calculateLayout(
  elements: Element[],
  config: LayoutConfig,
): LayoutResult[] {
  switch (config.type) {
    case "grid":
      return gridLayout(elements, {
        columns: Math.ceil(Math.sqrt(elements.length)),
        spacing: config.spacing,
      });

    case "circular":
      return circularLayout(elements, {
        radius: 200,
      });

    case "flowchart":
      return flowchartLayout(elements, {
        direction: config.direction,
        spacing: config.spacing,
        alignment: config.alignment,
      });

    case "orgchart":
    case "tree":
      return treelayerLayout(elements, {
        direction: config.direction,
        spacing: config.spacing,
      });

    default:
      return elements.map(el => ({
        elementId: el.id,
        x: el.x,
        y: el.y,
      }));
  }
}
