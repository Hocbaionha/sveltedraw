/**
 * appStore.svelte.ts
 *
 * App-scope reactive store (shared across the page — one instance per app root).
 * Provide via setContext(APP_STORE_KEY, createAppStore()) at the top of the app tree.
 *
 * Atoms covered (source location → field name):
 *   excalidraw-app/app-language/language-state.ts     appLangCodeAtom            → appLangCode
 *   excalidraw-app/collab/Collab.tsx                  collabAPIAtom              → collabAPI
 *   excalidraw-app/collab/Collab.tsx                  isCollaboratingAtom        → isCollaborating
 *   excalidraw-app/collab/Collab.tsx                  isOfflineAtom              → isOffline
 *   excalidraw-app/collab/Collab.tsx                  activeRoomLinkAtom         → activeRoomLink
 *   excalidraw-app/collab/CollabError.tsx             collabErrorIndicatorAtom   → collabErrorIndicator
 *   excalidraw-app/data/LocalData.ts                  localStorageQuotaExceeded  → localStorageQuotaExceeded
 *   excalidraw-app/share/ShareDialog.tsx              shareDialogStateAtom       → shareDialogState
 */

// ---------------------------------------------------------------------------
// Types (inlined to avoid deep app imports)
// ---------------------------------------------------------------------------

/**
 * Mirrors CollabAPI from excalidraw-app/collab/Collab.tsx.
 * Typed as `unknown` here; consumers should narrow to the real interface.
 * This avoids a circular dependency until proper Svelte collab modules exist.
 */
export type CollabAPI = unknown;

export type CollabErrorIndicator = {
  message: string | null;
  /** nonce bumped to trigger re-animation in the error indicator UI */
  nonce: number;
};

export type ShareDialogType = "share" | "collaborationOnly";

export type ShareDialogState =
  | { isOpen: false }
  | { isOpen: true; type: ShareDialogType };

// ---------------------------------------------------------------------------
// Utility: accept a plain value OR an updater function
// ---------------------------------------------------------------------------

type Updater<T> = T | ((prev: T) => T);

function applyUpdate<T>(prev: T, update: Updater<T>): T {
  return typeof update === "function"
    ? (update as (prev: T) => T)(prev)
    : update;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAppStore() {
  // --- Language -------------------------------------------------------------
  // TODO: call getPreferredLanguage() (i18next-browser-languagedetector +
  // supported languages list from excalidraw-app/app-language/language-detector.ts)
  // once that dependency is available here. For now default to "en"; the
  // root app component should call setAppLangCode(getPreferredLanguage())
  // immediately after creating the store.
  let appLangCode = $state<string>("en");

  // --- Collab ---------------------------------------------------------------
  let collabAPI = $state<CollabAPI | null>(null);
  let isCollaborating = $state(false);
  let isOffline = $state(false);
  let activeRoomLink = $state<string | null>(null);

  let collabErrorIndicator = $state<CollabErrorIndicator>({
    message: null,
    nonce: 0,
  });

  // --- Local Storage --------------------------------------------------------
  let localStorageQuotaExceeded = $state(false);

  // --- Share Dialog ---------------------------------------------------------
  let shareDialogState = $state<ShareDialogState>({ isOpen: false });

  // -------------------------------------------------------------------------
  // Returned store object
  // -------------------------------------------------------------------------

  return {
    // Language
    get appLangCode() {
      return appLangCode;
    },
    setAppLangCode(v: string) {
      appLangCode = v;
    },

    // Collab
    get collabAPI() {
      return collabAPI;
    },
    setCollabAPI(v: CollabAPI | null) {
      collabAPI = v;
    },
    get isCollaborating() {
      return isCollaborating;
    },
    setIsCollaborating(v: boolean) {
      isCollaborating = v;
    },
    get isOffline() {
      return isOffline;
    },
    setIsOffline(v: boolean) {
      isOffline = v;
    },
    get activeRoomLink() {
      return activeRoomLink;
    },
    setActiveRoomLink(v: string | null) {
      activeRoomLink = v;
    },
    get collabErrorIndicator() {
      return collabErrorIndicator;
    },
    setCollabErrorIndicator(v: Updater<CollabErrorIndicator>) {
      collabErrorIndicator = applyUpdate(collabErrorIndicator, v);
    },

    // Local Storage
    get localStorageQuotaExceeded() {
      return localStorageQuotaExceeded;
    },
    setLocalStorageQuotaExceeded(v: boolean) {
      localStorageQuotaExceeded = v;
    },

    // Share Dialog
    get shareDialogState() {
      return shareDialogState;
    },
    setShareDialogState(v: ShareDialogState) {
      shareDialogState = v;
    },
  };
}

export type AppStore = ReturnType<typeof createAppStore>;
