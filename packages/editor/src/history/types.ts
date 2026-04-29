// History Management System for Phase 16

export interface HistoryState {
  id: string;
  timestamp: number;
  description: string;
  elementCount: number;
  previewDataUrl?: string; // Base64 canvas snapshot (optional, generated on demand)
}

export interface HistoryConfig {
  maxStates: number; // Maximum number of states to keep in history
  captureSnapshots: boolean; // Whether to capture preview images
  snapshotQuality: number; // 0-1, JPEG quality for snapshots
}

export interface HistoryPoint {
  state: HistoryState;
  index: number; // Position in history (0 = oldest, current = length-1)
}

export const getDefaultHistoryConfig = (): HistoryConfig => ({
  maxStates: 100,
  captureSnapshots: false,
  snapshotQuality: 0.5,
});

export const createHistoryState = (
  id: string,
  description: string,
  elementCount: number,
  previewDataUrl?: string,
): HistoryState => ({
  id,
  timestamp: Date.now(),
  description,
  elementCount,
  previewDataUrl,
});

export const formatHistoryTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - timestamp;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString();
};

export const getActionDescription = (action: string): string => {
  const descriptions: Record<string, string> = {
    create: '✏️ Created element',
    delete: '🗑️ Deleted element',
    move: '↔️ Moved element',
    resize: '📏 Resized element',
    rotate: '🔄 Rotated element',
    style: '🎨 Changed style',
    group: '📁 Created group',
    ungroup: '📂 Ungrouped',
    text: '✍️ Edited text',
    paste: '📋 Pasted elements',
    duplicate: '📑 Duplicated',
    align: '▮▮ Aligned elements',
    arrange: '📊 Rearranged elements',
  };

  return descriptions[action] || '🔄 Made changes';
};
