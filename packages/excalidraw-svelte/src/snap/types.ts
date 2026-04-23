// Snap & Grid System for Phase 14

export interface GridConfig {
  enabled: boolean;
  size: number; // pixels
  visible: boolean;
  opacity: number; // 0-1
}

export interface SnapGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  elements: string[]; // element IDs that align
}

export interface SnapConfig {
  enabled: boolean;
  threshold: number; // pixels within which to snap
  guides: boolean; // show snap guides
  // Phase 14 Feature 4: Snap preferences
  snapToGrid?: boolean;
  snapToElements?: boolean;
  snapEdges?: boolean;
  snapCenters?: boolean;
  showDistance?: boolean;
}

export interface SnapPoint {
  x?: number;
  y?: number;
  guideX?: number;
  guideY?: number;
  alignedElements?: string[];
}

export const DEFAULT_GRID_SIZE = 20;
export const DEFAULT_SNAP_THRESHOLD = 8;
export const DEFAULT_GRID_OPACITY = 0.15;

export function createGridConfig(overrides?: Partial<GridConfig>): GridConfig {
  return {
    enabled: true,
    size: DEFAULT_GRID_SIZE,
    visible: false,
    opacity: DEFAULT_GRID_OPACITY,
    ...overrides,
  };
}

export function createSnapConfig(overrides?: Partial<SnapConfig>): SnapConfig {
  return {
    enabled: true,
    threshold: DEFAULT_SNAP_THRESHOLD,
    guides: true,
    snapToGrid: true,
    snapToElements: true,
    snapEdges: true,
    snapCenters: true,
    showDistance: true,
    ...overrides,
  };
}

export function calculateSnapPoints(
  element: { x: number; y: number; width: number; height: number },
  allElements: Array<{ id: string; x: number; y: number; width: number; height: number }>,
  threshold: number,
): SnapPoint {
  const snapPoint: SnapPoint = {};

  const elementLeft = element.x;
  const elementRight = element.x + element.width;
  const elementCenterX = element.x + element.width / 2;
  const elementTop = element.y;
  const elementBottom = element.y + element.height;
  const elementCenterY = element.y + element.height / 2;

  let closestX: { distance: number; position: number; elements: string[] } | null = null;
  let closestY: { distance: number; position: number; elements: string[] } | null = null;

  for (const other of allElements) {
    if (other.id === element.id) continue;

    const otherLeft = other.x;
    const otherRight = other.x + other.width;
    const otherCenterX = other.x + other.width / 2;
    const otherTop = other.y;
    const otherBottom = other.y + other.height;
    const otherCenterY = other.y + other.height / 2;

    // Check horizontal alignments
    const xAlignments = [
      { position: otherLeft, distance: Math.abs(elementLeft - otherLeft) },
      { position: otherRight, distance: Math.abs(elementRight - otherRight) },
      { position: otherCenterX, distance: Math.abs(elementCenterX - otherCenterX) },
    ];

    for (const alignment of xAlignments) {
      if (alignment.distance <= threshold) {
        if (!closestX || alignment.distance < closestX.distance) {
          closestX = {
            distance: alignment.distance,
            position: alignment.position,
            elements: [other.id],
          };
        } else if (alignment.distance === closestX.distance) {
          closestX.elements.push(other.id);
        }
      }
    }

    // Check vertical alignments
    const yAlignments = [
      { position: otherTop, distance: Math.abs(elementTop - otherTop) },
      { position: otherBottom, distance: Math.abs(elementBottom - otherBottom) },
      { position: otherCenterY, distance: Math.abs(elementCenterY - otherCenterY) },
    ];

    for (const alignment of yAlignments) {
      if (alignment.distance <= threshold) {
        if (!closestY || alignment.distance < closestY.distance) {
          closestY = {
            distance: alignment.distance,
            position: alignment.position,
            elements: [other.id],
          };
        } else if (alignment.distance === closestY.distance) {
          closestY.elements.push(other.id);
        }
      }
    }
  }

  if (closestX) {
    snapPoint.guideX = closestX.position;
    snapPoint.alignedElements = closestX.elements;
  }

  if (closestY) {
    snapPoint.guideY = closestY.position;
    snapPoint.alignedElements = [...(snapPoint.alignedElements || []), ...closestY.elements];
  }

  return snapPoint;
}

export function snapToGrid(position: number, gridSize: number): number {
  return Math.round(position / gridSize) * gridSize;
}

export function getGridLines(
  width: number,
  height: number,
  gridSize: number,
): { vertical: number[]; horizontal: number[] } {
  const vertical: number[] = [];
  const horizontal: number[] = [];

  for (let x = 0; x <= width; x += gridSize) {
    vertical.push(x);
  }

  for (let y = 0; y <= height; y += gridSize) {
    horizontal.push(y);
  }

  return { vertical, horizontal };
}
