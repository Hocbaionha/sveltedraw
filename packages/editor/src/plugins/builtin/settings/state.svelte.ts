// Plugin-local state + persistence for the Settings panel.

const STORAGE_KEY = "sveltedraw-settings";

export interface AppSettings {
  theme: "light" | "dark" | "auto";
  gridVisible: boolean;
  gridSize: number;
  snapToGrid: boolean;
  autoSaveInterval: number;
  undoHistorySize: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "light",
  gridVisible: true,
  gridSize: 20,
  snapToGrid: false,
  autoSaveInterval: 30,
  undoHistorySize: 500,
};

export type SettingsState = {
  open: boolean;
  values: AppSettings;
};

export function createState(): SettingsState {
  const s: SettingsState = $state({
    open: false,
    values: { ...DEFAULT_SETTINGS },
  });
  return s;
}

export function loadFromStorage(state: SettingsState): void {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    state.values = { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    /* corrupted — use defaults */
  }
}

export function persistToStorage(state: SettingsState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.values));
  } catch {
    /* quota exceeded */
  }
}
