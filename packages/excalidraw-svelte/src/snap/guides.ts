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
