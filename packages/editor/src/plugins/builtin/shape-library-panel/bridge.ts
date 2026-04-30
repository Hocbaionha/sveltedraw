// Bridge for the ShapeLibrary side panel. Library state + handlers
// stay in App.svelte (handlers wire into scene mutation + persistence).

import type { LibraryComponent, LibraryCategory } from "../../../library/types.js";

export const SHAPE_LIBRARY_BRIDGE_KEY: unique symbol =
  Symbol("shapeLibraryPanelBridge");

export type ShapeLibraryBridge = {
  /** Reactive: current library components. */
  readonly components: readonly LibraryComponent[];
  /** Reactive: available categories. */
  readonly categories: readonly LibraryCategory[];
  /** Reactive: currently-active category filter. */
  readonly selectedCategoryId: string;
  /** Reactive: search query string. */
  readonly searchQuery: string;
  setSelectedCategory(id: string): void;
  setSearchQuery(q: string): void;
  onSelectComponent(component: LibraryComponent): void;
  onDeleteComponent(id: string): void;
  onExport(): void;
  onImport(): void;
};
