// Snap Guides Management for Phase 14 Feature 3

export interface SnapGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  color?: string;
  elements?: string[]; // IDs of elements that align
}

export interface SnapGuideState {
  guides: SnapGuide[];
  isDragging: boolean;
  draggedElementId: string | null;
}

export const createSnapGuideState = (): SnapGuideState => ({
  guides: [],
  isDragging: false,
  draggedElementId: null,
});

export function detectSnapGuides(
  draggedElement: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  },
  allElements: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>,
  threshold: number,
): SnapGuide[] {
  const guides: SnapGuide[] = [];

  const draggedLeft = draggedElement.x;
  const draggedRight = draggedElement.x + draggedElement.width;
  const draggedCenterX = draggedElement.x + draggedElement.width / 2;
  const draggedTop = draggedElement.y;
  const draggedBottom = draggedElement.y + draggedElement.height;
  const draggedCenterY = draggedElement.y + draggedElement.height / 2;

  const snapThresholdX = threshold;
  const snapThresholdY = threshold;

  for (const other of allElements) {
    if (other.id === draggedElement.id) continue;

    const otherLeft = other.x;
    const otherRight = other.x + other.width;
    const otherCenterX = other.x + other.width / 2;
    const otherTop = other.y;
    const otherBottom = other.y + other.height;
    const otherCenterY = other.y + other.height / 2;

    // Vertical snap guides (left, right, center)
    if (Math.abs(draggedLeft - otherLeft) < snapThresholdX) {
      const guide = guides.find(g => g.type === 'vertical' && Math.abs(g.position - otherLeft) < 1);
      if (guide) {
        guide.elements = [...(guide.elements || []), other.id];
      } else {
        guides.push({
          type: 'vertical',
          position: otherLeft,
          color: '#1890ff',
          elements: [other.id],
        });
      }
    }

    if (Math.abs(draggedRight - otherRight) < snapThresholdX) {
      const guide = guides.find(g => g.type === 'vertical' && Math.abs(g.position - otherRight) < 1);
      if (guide) {
        guide.elements = [...(guide.elements || []), other.id];
      } else {
        guides.push({
          type: 'vertical',
          position: otherRight,
          color: '#1890ff',
          elements: [other.id],
        });
      }
    }

    if (Math.abs(draggedCenterX - otherCenterX) < snapThresholdX) {
      const guide = guides.find(g => g.type === 'vertical' && Math.abs(g.position - otherCenterX) < 1);
      if (guide) {
        guide.elements = [...(guide.elements || []), other.id];
      } else {
        guides.push({
          type: 'vertical',
          position: otherCenterX,
          color: '#52c41a',
          elements: [other.id],
        });
      }
    }

    // Horizontal snap guides (top, bottom, center)
    if (Math.abs(draggedTop - otherTop) < snapThresholdY) {
      const guide = guides.find(g => g.type === 'horizontal' && Math.abs(g.position - otherTop) < 1);
      if (guide) {
        guide.elements = [...(guide.elements || []), other.id];
      } else {
        guides.push({
          type: 'horizontal',
          position: otherTop,
          color: '#1890ff',
          elements: [other.id],
        });
      }
    }

    if (Math.abs(draggedBottom - otherBottom) < snapThresholdY) {
      const guide = guides.find(g => g.type === 'horizontal' && Math.abs(g.position - otherBottom) < 1);
      if (guide) {
        guide.elements = [...(guide.elements || []), other.id];
      } else {
        guides.push({
          type: 'horizontal',
          position: otherBottom,
          color: '#1890ff',
          elements: [other.id],
        });
      }
    }

    if (Math.abs(draggedCenterY - otherCenterY) < snapThresholdY) {
      const guide = guides.find(g => g.type === 'horizontal' && Math.abs(g.position - otherCenterY) < 1);
      if (guide) {
        guide.elements = [...(guide.elements || []), other.id];
      } else {
        guides.push({
          type: 'horizontal',
          position: otherCenterY,
          color: '#52c41a',
          elements: [other.id],
        });
      }
    }
  }

  return guides;
}

// Drag-time snap used by App.svelte's pointermove handler. Given the
// candidate post-drag position of the primary element, returns:
//   - snapOffsetX/Y: delta to add on top of the raw drag delta so the
//     element lands exactly on a snap target
//   - guides: SnapGuide[] for the overlay renderer (A6)
// Edges vs centers honor the snapEdges/snapCenters config flags.
// `snapToGrid === true` additionally snaps to the nearest grid multiple,
// but only when no element-snap was hit on that axis (element snap wins).
export function computeDragSnap(
  candidate: { x: number; y: number; width: number; height: number },
  others: Array<{ id: string; x: number; y: number; width: number; height: number }>,
  opts: {
    threshold: number;
    snapToGrid: boolean;
    snapToElements: boolean;
    snapEdges: boolean;
    snapCenters: boolean;
    gridSize: number;
  },
): { snapOffsetX: number; snapOffsetY: number; guides: SnapGuide[] } {
  const guides: SnapGuide[] = [];
  let snapOffsetX = 0;
  let snapOffsetY = 0;
  let hitX = false;
  let hitY = false;

  if (opts.snapToElements && (opts.snapEdges || opts.snapCenters)) {
    const cLeft = candidate.x;
    const cRight = candidate.x + candidate.width;
    const cCenterX = candidate.x + candidate.width / 2;
    const cTop = candidate.y;
    const cBottom = candidate.y + candidate.height;
    const cCenterY = candidate.y + candidate.height / 2;

    let bestX: { dist: number; offset: number; guide: SnapGuide } | null = null;
    let bestY: { dist: number; offset: number; guide: SnapGuide } | null = null;

    for (const o of others) {
      const oLeft = o.x;
      const oRight = o.x + o.width;
      const oCenterX = o.x + o.width / 2;
      const oTop = o.y;
      const oBottom = o.y + o.height;
      const oCenterY = o.y + o.height / 2;

      const xCandidates: Array<[number, number, string]> = [];
      if (opts.snapEdges) {
        xCandidates.push([cLeft, oLeft, '#1890ff']);
        xCandidates.push([cRight, oRight, '#1890ff']);
        xCandidates.push([cLeft, oRight, '#1890ff']);
        xCandidates.push([cRight, oLeft, '#1890ff']);
      }
      if (opts.snapCenters) {
        xCandidates.push([cCenterX, oCenterX, '#52c41a']);
      }
      for (const [cPos, oPos, color] of xCandidates) {
        const d = Math.abs(cPos - oPos);
        if (d <= opts.threshold && (!bestX || d < bestX.dist)) {
          bestX = {
            dist: d,
            offset: oPos - cPos,
            guide: { type: 'vertical', position: oPos, color, elements: [o.id] },
          };
        }
      }

      const yCandidates: Array<[number, number, string]> = [];
      if (opts.snapEdges) {
        yCandidates.push([cTop, oTop, '#1890ff']);
        yCandidates.push([cBottom, oBottom, '#1890ff']);
        yCandidates.push([cTop, oBottom, '#1890ff']);
        yCandidates.push([cBottom, oTop, '#1890ff']);
      }
      if (opts.snapCenters) {
        yCandidates.push([cCenterY, oCenterY, '#52c41a']);
      }
      for (const [cPos, oPos, color] of yCandidates) {
        const d = Math.abs(cPos - oPos);
        if (d <= opts.threshold && (!bestY || d < bestY.dist)) {
          bestY = {
            dist: d,
            offset: oPos - cPos,
            guide: { type: 'horizontal', position: oPos, color, elements: [o.id] },
          };
        }
      }
    }

    if (bestX) {
      snapOffsetX = bestX.offset;
      guides.push(bestX.guide);
      hitX = true;
    }
    if (bestY) {
      snapOffsetY = bestY.offset;
      guides.push(bestY.guide);
      hitY = true;
    }
  }

  if (opts.snapToGrid && opts.gridSize > 0) {
    if (!hitX) {
      const target = Math.round(candidate.x / opts.gridSize) * opts.gridSize;
      const d = target - candidate.x;
      if (Math.abs(d) <= opts.threshold) snapOffsetX = d;
    }
    if (!hitY) {
      const target = Math.round(candidate.y / opts.gridSize) * opts.gridSize;
      const d = target - candidate.y;
      if (Math.abs(d) <= opts.threshold) snapOffsetY = d;
    }
  }

  return { snapOffsetX, snapOffsetY, guides };
}

export function clearSnapGuides(state: SnapGuideState): SnapGuideState {
  return {
    ...state,
    guides: [],
    isDragging: false,
    draggedElementId: null,
  };
}

export function updateSnapGuides(
  state: SnapGuideState,
  draggedElement: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  },
  allElements: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>,
  threshold: number,
): SnapGuideState {
  if (!state.isDragging || !state.draggedElementId) {
    return state;
  }

  const guides = detectSnapGuides(draggedElement, allElements, threshold);

  return {
    ...state,
    guides,
  };
}
