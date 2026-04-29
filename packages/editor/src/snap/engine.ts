// Advanced Snap Engine for Phase 14 Feature 4

export interface SnapPosition {
  x?: number;
  y?: number;
  guidesX?: number[];
  guidesY?: number[];
  distances?: { x?: number; y?: number };
}

export interface SnapPreferences {
  snapToGrid: boolean;
  snapToElements: boolean;
  snapEdges: boolean;
  snapCenters: boolean;
  showDistance: boolean;
}

export const DEFAULT_SNAP_PREFS: SnapPreferences = {
  snapToGrid: true,
  snapToElements: true,
  snapEdges: true,
  snapCenters: true,
  showDistance: true,
};

export function snapToGrid(position: number, gridSize: number): number {
  return Math.round(position / gridSize) * gridSize;
}

export function calculateSnapPosition(
  element: { id?: string; x: number; y: number; width: number; height: number },
  allElements: Array<{ id?: string; x: number; y: number; width: number; height: number }>,
  gridSize: number,
  snapThreshold: number,
  prefs: SnapPreferences,
): SnapPosition {
  const result: SnapPosition = {};

  // Grid snapping
  if (prefs.snapToGrid) {
    const snappedX = snapToGrid(element.x, gridSize);
    const snappedY = snapToGrid(element.y, gridSize);

    if (Math.abs(element.x - snappedX) < snapThreshold) {
      result.x = snappedX;
    }
    if (Math.abs(element.y - snappedY) < snapThreshold) {
      result.y = snappedY;
    }
  }

  // Element snapping
  if (prefs.snapToElements) {
    const elementLeft = element.x;
    const elementRight = element.x + element.width;
    const elementCenterX = element.x + element.width / 2;
    const elementTop = element.y;
    const elementBottom = element.y + element.height;
    const elementCenterY = element.y + element.height / 2;

    let closestX: { distance: number; position: number; distance_value: number } | null = null;
    let closestY: { distance: number; position: number; distance_value: number } | null = null;

    for (const other of allElements) {
      if (element.id && other.id === element.id) continue;

      const otherLeft = other.x;
      const otherRight = other.x + other.width;
      const otherCenterX = other.x + other.width / 2;
      const otherTop = other.y;
      const otherBottom = other.y + other.height;
      const otherCenterY = other.y + other.height / 2;

      // Edge snapping
      if (prefs.snapEdges) {
        const alignments = [
          { pos: otherLeft, dist: Math.abs(elementLeft - otherLeft) },
          { pos: otherRight, dist: Math.abs(elementRight - otherRight) },
          { pos: otherTop, dist: Math.abs(elementTop - otherTop) },
          { pos: otherBottom, dist: Math.abs(elementBottom - otherBottom) },
        ];

        for (const align of alignments) {
          if (align.dist < snapThreshold) {
            const isX = align.pos === otherLeft || align.pos === otherRight;
            if (isX) {
              if (!closestX || align.dist < closestX.distance) {
                closestX = { distance: align.dist, position: align.pos, distance_value: align.dist };
              }
            } else {
              if (!closestY || align.dist < closestY.distance) {
                closestY = { distance: align.dist, position: align.pos, distance_value: align.dist };
              }
            }
          }
        }
      }

      // Center snapping
      if (prefs.snapCenters) {
        const centerXDist = Math.abs(elementCenterX - otherCenterX);
        const centerYDist = Math.abs(elementCenterY - otherCenterY);

        if (centerXDist < snapThreshold) {
          if (!closestX || centerXDist < closestX.distance) {
            closestX = { distance: centerXDist, position: otherCenterX, distance_value: centerXDist };
          }
        }

        if (centerYDist < snapThreshold) {
          if (!closestY || centerYDist < closestY.distance) {
            closestY = { distance: centerYDist, position: otherCenterY, distance_value: centerYDist };
          }
        }
      }
    }

    if (closestX && (!result.x || Math.abs(closestX.position - element.x) < Math.abs(result.x - element.x))) {
      result.x = closestX.position;
      if (!result.distances) result.distances = {};
      result.distances.x = closestX.distance_value;
    }

    if (closestY && (!result.y || Math.abs(closestY.position - element.y) < Math.abs(result.y - element.y))) {
      result.y = closestY.position;
      if (!result.distances) result.distances = {};
      result.distances.y = closestY.distance_value;
    }
  }

  return result;
}

export function applySnapPosition(
  element: { x: number; y: number; width: number; height: number },
  snapPos: SnapPosition,
): { x: number; y: number; width: number; height: number } {
  return {
    ...element,
    x: snapPos.x !== undefined ? snapPos.x : element.x,
    y: snapPos.y !== undefined ? snapPos.y : element.y,
  };
}
