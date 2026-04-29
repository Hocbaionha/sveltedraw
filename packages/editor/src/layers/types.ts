// Layer Management System for Phase 15

export interface LayerItem {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  type: 'element' | 'group';
  parentId?: string;
  children?: string[]; // for groups
  order: number;
}

export interface LayerGroup {
  id: string;
  name: string;
  visible: boolean;
  collapsed: boolean;
  children: LayerItem[];
}

export interface LayerConfig {
  showLayerPanel: boolean;
  selectedLayerId: string | null;
  expandedGroups: Set<string>;
}

export const createLayerItem = (
  id: string,
  name: string,
  order: number,
): LayerItem => ({
  id,
  name,
  visible: true,
  locked: false,
  opacity: 1,
  type: 'element',
  order,
});

export const createLayerGroup = (id: string, name: string): LayerGroup => ({
  id,
  name,
  visible: true,
  collapsed: false,
  children: [],
});

export function getLayerName(element: any): string {
  // Get a readable name for an element
  if (element.text) return `Text: "${element.text.substring(0, 20)}"`;
  if (element.type === 'image') return 'Image';
  if (element.type === 'freedraw') return 'Pen';
  if (element.type === 'line') return 'Line';
  if (element.type === 'arrow') return 'Arrow';
  if (element.type === 'rectangle') return 'Rectangle';
  if (element.type === 'diamond') return 'Diamond';
  if (element.type === 'ellipse') return 'Circle';
  if (element.type === 'frame') return `Frame: ${element.name || 'Untitled'}`;
  return element.type ? element.type.charAt(0).toUpperCase() + element.type.slice(1) : 'Element';
}

export function sortLayersByOrder(layers: LayerItem[]): LayerItem[] {
  return [...layers].sort((a, b) => a.order - b.order);
}

export function updateLayerVisibility(
  layers: LayerItem[],
  layerId: string,
  visible: boolean,
): LayerItem[] {
  return layers.map(layer =>
    layer.id === layerId ? { ...layer, visible } : layer,
  );
}

export function updateLayerLock(
  layers: LayerItem[],
  layerId: string,
  locked: boolean,
): LayerItem[] {
  return layers.map(layer =>
    layer.id === layerId ? { ...layer, locked } : layer,
  );
}

export function updateLayerOpacity(
  layers: LayerItem[],
  layerId: string,
  opacity: number,
): LayerItem[] {
  return layers.map(layer =>
    layer.id === layerId ? { ...layer, opacity: Math.max(0, Math.min(1, opacity)) } : layer,
  );
}

export function renameLayer(
  layers: LayerItem[],
  layerId: string,
  name: string,
): LayerItem[] {
  return layers.map(layer =>
    layer.id === layerId ? { ...layer, name } : layer,
  );
}

export function reorderLayers(
  layers: LayerItem[],
  fromId: string,
  toIndex: number,
): LayerItem[] {
  const layer = layers.find(l => l.id === fromId);
  if (!layer) return layers;

  const filtered = layers.filter(l => l.id !== fromId);
  const newLayers = [
    ...filtered.slice(0, toIndex),
    layer,
    ...filtered.slice(toIndex),
  ];

  return newLayers.map((l, i) => ({ ...l, order: i }));
}
