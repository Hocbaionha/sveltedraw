// Plugin-local state for the Recent Files feature. Mirrors the inline
// state that previously lived in App.svelte (recentFiles array, open
// flag, persistence key).

import { randomId } from "@sveltedraw/common";

const STORAGE_KEY = "sveltedraw-recent-files";
const MAX_FILES = 10;

export type RecentFile = {
  id: string;
  name: string;
  timestamp: number;
};

export type RecentFilesState = {
  open: boolean;
  files: RecentFile[];
};

export function createState(): RecentFilesState {
  // $state must be a variable declaration initializer in Svelte 5; it
  // can't sit inside a return expression. Bind to a local first then
  // hand it back.
  const s: RecentFilesState = $state({
    open: false,
    files: [],
  });
  return s;
}

/** Hydrate `state.files` from localStorage. Silent on corruption. */
export function loadFromStorage(state: RecentFilesState): void {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as RecentFile[];
    if (Array.isArray(parsed)) state.files = parsed;
  } catch {
    /* corrupted — start fresh */
  }
}

/** Write current `state.files` to localStorage. Silent on quota error. */
export function persistToStorage(state: RecentFilesState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.files));
  } catch {
    /* quota exceeded */
  }
}

/**
 * Add or bump a filename in the recent list. If the name (case-
 * insensitive) already exists its timestamp is refreshed; otherwise a
 * fresh entry is unshifted onto the front. List is capped at MAX_FILES.
 */
export function addFile(state: RecentFilesState, filename: string): void {
  const existing = state.files.find(
    (f) => f.name.toLowerCase() === filename.toLowerCase(),
  );
  if (existing) {
    existing.timestamp = Date.now();
  } else {
    state.files.unshift({
      id: randomId(),
      name: filename,
      timestamp: Date.now(),
    });
  }
  if (state.files.length > MAX_FILES) {
    state.files = state.files.slice(0, MAX_FILES);
  }
  persistToStorage(state);
}

export function deleteFile(state: RecentFilesState, id: string): void {
  state.files = state.files.filter((f) => f.id !== id);
  persistToStorage(state);
}
