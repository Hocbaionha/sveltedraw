// Shape Library & Component Manager for Phase 16 Feature 2

export interface LibraryComponent {
  id: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  created: number;
  modified: number;
  elements: any[]; // Serialized Excalidraw elements
  thumbnail?: string; // Base64 preview image
  usage: number; // How many times used
}

export interface LibraryCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  collapsed?: boolean;
}

export interface LibraryConfig {
  maxComponents: number;
  maxStorageSize: number; // bytes
  defaultCategories: LibraryCategory[];
  autoBackup: boolean;
  backupInterval: number; // ms
}

export const getDefaultLibraryConfig = (): LibraryConfig => ({
  maxComponents: 200,
  maxStorageSize: 10 * 1024 * 1024, // 10MB
  defaultCategories: [
    { id: 'shapes', name: 'Basic Shapes', icon: '◯', color: '#6965db' },
    { id: 'arrows', name: 'Arrows', icon: '→', color: '#1e90ff' },
    { id: 'diagrams', name: 'Diagrams', icon: '◇', color: '#ff6b6b' },
    { id: 'icons', name: 'Icons', icon: '⭐', color: '#ffd700' },
    { id: 'custom', name: 'Custom', icon: '▫', color: '#888888' },
  ],
  autoBackup: true,
  backupInterval: 300000, // 5 minutes
});

export const createLibraryComponent = (
  name: string,
  category: string,
  elements: any[],
  description?: string,
  tags?: string[],
  thumbnail?: string,
): LibraryComponent => ({
  id: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: name.trim() || 'Unnamed Component',
  description,
  category,
  tags: tags || [],
  created: Date.now(),
  modified: Date.now(),
  elements,
  thumbnail,
  usage: 0,
});

export const getCategoryLabel = (categoryId: string, categories: LibraryCategory[]): string => {
  const cat = categories.find(c => c.id === categoryId);
  return cat?.name || 'Uncategorized';
};

export const filterComponentsByCategory = (
  components: LibraryComponent[],
  categoryId: string,
): LibraryComponent[] => {
  if (categoryId === 'all') return components;
  return components.filter(c => c.category === categoryId);
};

export const searchComponents = (
  components: LibraryComponent[],
  query: string,
): LibraryComponent[] => {
  if (!query.trim()) return components;
  const lower = query.toLowerCase();
  return components.filter(
    c =>
      c.name.toLowerCase().includes(lower) ||
      c.description?.toLowerCase().includes(lower) ||
      c.tags.some(t => t.toLowerCase().includes(lower)),
  );
};

export const estimateStorageSize = (component: LibraryComponent): number => {
  // Rough estimate: JSON string size
  return JSON.stringify(component).length;
};
