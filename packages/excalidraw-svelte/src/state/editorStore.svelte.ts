/**
 * editorStore.svelte.ts
 *
 * Editor-scope reactive store (one instance per <Excalidraw> root).
 * Each field is a private $state with a getter/setter pair so external
 * code cannot bypass reactivity by assigning directly.
 *
 * Atoms covered (source location → field name):
 *   components/ActiveConfirmDialog.tsx        activeConfirmDialogAtom         → activeConfirmDialog
 *   components/EyeDropper.tsx                 activeEyeDropperAtom            → activeEyeDropper
 *   components/ColorPicker/colorPickerUtils   activeColorPickerSectionAtom    → activeColorPickerSection
 *   components/ConvertElementTypePopup.tsx    convertElementTypePopupAtom     → convertElementTypePopup
 *   components/OverwriteConfirm/…State.ts    overwriteConfirmStateAtom       → overwriteConfirmState
 *   components/LibraryMenu.tsx                isLibraryMenuOpenAtom           → isLibraryMenuOpen
 *   components/SearchMenu.tsx                 searchQueryAtom                 → searchQuery
 *   components/SearchMenu.tsx                 searchItemInFocusAtom           → searchItemInFocus
 *   components/Sidebar/Sidebar.tsx            isSidebarDockedAtom             → isSidebarDocked
 *   components/IconPicker.tsx                 moreOptionsAtom                 → iconPickerMoreOptions
 *   components/CommandPalette/CommandPalette  lastUsedPaletteItem             → lastUsedPaletteItem
 *   data/library.ts                           libraryItemsAtom                → libraryItems
 *   hooks/useLibraryItemSvg.ts                libraryItemSvgsCache            → libraryItemSvgsCache
 *   hooks/useScrollPosition.ts                scrollPositionAtom              → scrollPosition
 *   i18n.ts                                   editorLangCodeAtom              → editorLangCode
 *   components/TTDDialog/TTDContext.tsx        rateLimitsAtom                  → ttdRateLimits
 *   components/TTDDialog/TTDContext.tsx        showPreviewAtom                 → ttdShowPreview
 *   components/TTDDialog/TTDContext.tsx        errorAtom                       → ttdError
 *   components/TTDDialog/TTDContext.tsx        chatHistoryAtom                 → ttdChatHistory
 *   components/TTDDialog/useTTDChatStorage    savedChatsAtom                  → ttdSavedChats
 *   components/TTDDialog/useTTDChatStorage    isLoadingChatsAtom              → ttdIsLoadingChats
 *   components/TTDDialog/useTTDChatStorage    chatsLoadedAtom                 → ttdChatsLoaded
 *
 * Isolation: every createEditorStore() call produces a fresh store, provided
 * via setContext(EDITOR_STORE_KEY, store) at the <Excalidraw> root so multiple
 * editors on one page do not share state.
 */

// @ts-ignore — resolved by Vite alias; no tsconfig path to avoid upstream cascade
import { randomId } from "@excalidraw/common";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal LibraryItem shape required by this store.
 * The full type lives in packages/excalidraw/types.ts → LibraryItem.
 * We inline just what we need here to avoid a cross-package type import
 * until the build pipeline is configured.
 *
 * TODO: Replace with `import type { LibraryItem, LibraryItems } from "@excalidraw/excalidraw/types"`
 * once the `./types` sub-path is confirmed to resolve in the build setup.
 */
type LibraryItem = { id: string; elements: readonly unknown[] } & Record<
  string,
  unknown
>;
type LibraryItems = readonly LibraryItem[];

export type ActiveColorPickerSection =
  | "custom"
  | "baseColors"
  | "shades"
  | "hex"
  | null;

export type ColorPickerType =
  | "canvasBackground"
  | "elementBackground"
  | "elementStroke";

export type EyeDropperProperties = {
  keepOpenOnAlt: boolean;
  swapPreviewOnAlt?: boolean;
  onSelect: (color: string, event: PointerEvent) => void;
  colorPickerType: ColorPickerType;
};

export type ConvertElementTypePopupState = { type: "panel" } | null;

export type OverwriteConfirmState =
  | {
      active: true;
      title: string;
      description: string;
      actionLabel: string;
      color: "danger" | "warning";
      onClose: () => void;
      onConfirm: () => void;
      onReject: () => void;
    }
  | { active: false };

export type SvgCache = Map<LibraryItem["id"], SVGSVGElement>;

// ---------------------------------------------------------------------------
// TTD types (inlined to avoid deep package imports)
// ---------------------------------------------------------------------------

export type RateLimits = {
  rateLimit: number;
  rateLimitRemaining: number;
};

export type ChatMessage = {
  id: string;
  timestamp: Date;
  isGenerating?: boolean;
  error?: string;
  errorDetails?: string;
  errorType?: "parse" | "network" | "other";
  lastAttemptAt?: number;
  type: "user" | "assistant" | "warning";
  warningType?: "messageLimitExceeded" | "rateLimitExceeded";
  content?: string;
};

export type ChatHistory = {
  id: string;
  messages: ChatMessage[];
  currentPrompt: string;
};

export type SavedChat = {
  id: string;
  title: string;
  messages: ChatMessage[];
  currentPrompt: string;
  timestamp: number;
};

export type SavedChats = SavedChat[];

// ---------------------------------------------------------------------------
// CommandPalette item type (simplified — no ActionManager import)
// ---------------------------------------------------------------------------

export type CommandPaletteItem = {
  label: string;
  keywords?: string[];
  haystack?: string;
  category: string;
  order?: number;
  shortcut?: string | null;
  viewMode?: boolean;
  /** Typed loosely here to avoid pulling in ActionManager */
  perform: (...args: unknown[]) => void;
};

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

export function createEditorStore() {
  // --- ColorPicker -----------------------------------------------------------
  let activeColorPickerSection = $state<ActiveColorPickerSection>(null);

  // --- EyeDropper -----------------------------------------------------------
  let activeEyeDropper = $state<EyeDropperProperties | null>(null);

  // --- ConvertElementTypePopup ----------------------------------------------
  let convertElementTypePopup = $state<ConvertElementTypePopupState>(null);

  // --- ActiveConfirmDialog --------------------------------------------------
  let activeConfirmDialog = $state<"clearCanvas" | null>(null);

  // --- OverwriteConfirm -----------------------------------------------------
  let overwriteConfirmState = $state<OverwriteConfirmState>({ active: false });

  // --- LibraryMenu ----------------------------------------------------------
  let isLibraryMenuOpen = $state(false);

  // --- Sidebar --------------------------------------------------------------
  let isSidebarDocked = $state(false);

  // --- SearchMenu -----------------------------------------------------------
  let searchQuery = $state<string>("");
  let searchItemInFocus = $state<number | null>(null);

  // --- IconPicker -----------------------------------------------------------
  let iconPickerMoreOptions = $state(false);

  // --- CommandPalette -------------------------------------------------------
  let lastUsedPaletteItem = $state<CommandPaletteItem | null>(null);

  // --- Library --------------------------------------------------------------
  let libraryItems = $state<{
    status: "loading" | "loaded";
    isInitialized: boolean;
    libraryItems: LibraryItems;
  }>({ status: "loaded", isInitialized: false, libraryItems: [] });

  let libraryItemSvgsCache = $state<SvgCache>(new Map());

  // --- Scroll ---------------------------------------------------------------
  let scrollPosition = $state<number>(0);

  // --- i18n -----------------------------------------------------------------
  // Default value comes from the runtime; store is created before lang loads
  let editorLangCode = $state<string>("en");

  // --- TTD Dialog -----------------------------------------------------------
  let ttdRateLimits = $state<RateLimits | null>(null);
  let ttdShowPreview = $state<boolean>(false);
  let ttdError = $state<Error | null>(null);
  let ttdChatHistory = $state<ChatHistory>({
    id: randomId(),
    messages: [],
    currentPrompt: "",
  });
  let ttdSavedChats = $state<SavedChats>([]);
  let ttdIsLoadingChats = $state<boolean>(false);
  let ttdChatsLoaded = $state<boolean>(false);

  // -------------------------------------------------------------------------
  // Returned store object — only getters/setters, never the raw let bindings
  // -------------------------------------------------------------------------

  return {
    // ColorPicker
    get activeColorPickerSection() {
      return activeColorPickerSection;
    },
    setActiveColorPickerSection(v: ActiveColorPickerSection) {
      activeColorPickerSection = v;
    },

    // EyeDropper
    get activeEyeDropper() {
      return activeEyeDropper;
    },
    setActiveEyeDropper(v: Updater<EyeDropperProperties | null>) {
      activeEyeDropper = applyUpdate(activeEyeDropper, v);
    },

    // ConvertElementTypePopup
    get convertElementTypePopup() {
      return convertElementTypePopup;
    },
    setConvertElementTypePopup(v: ConvertElementTypePopupState) {
      convertElementTypePopup = v;
    },

    // ActiveConfirmDialog
    get activeConfirmDialog() {
      return activeConfirmDialog;
    },
    setActiveConfirmDialog(v: "clearCanvas" | null) {
      activeConfirmDialog = v;
    },

    // OverwriteConfirm
    get overwriteConfirmState() {
      return overwriteConfirmState;
    },
    setOverwriteConfirmState(v: OverwriteConfirmState) {
      overwriteConfirmState = v;
    },

    // LibraryMenu
    get isLibraryMenuOpen() {
      return isLibraryMenuOpen;
    },
    setIsLibraryMenuOpen(v: boolean) {
      isLibraryMenuOpen = v;
    },

    // Sidebar
    get isSidebarDocked() {
      return isSidebarDocked;
    },
    setIsSidebarDocked(v: boolean) {
      isSidebarDocked = v;
    },

    // SearchMenu
    get searchQuery() {
      return searchQuery;
    },
    setSearchQuery(v: string) {
      searchQuery = v;
    },
    get searchItemInFocus() {
      return searchItemInFocus;
    },
    setSearchItemInFocus(v: number | null) {
      searchItemInFocus = v;
    },

    // IconPicker
    get iconPickerMoreOptions() {
      return iconPickerMoreOptions;
    },
    setIconPickerMoreOptions(v: boolean) {
      iconPickerMoreOptions = v;
    },

    // CommandPalette
    get lastUsedPaletteItem() {
      return lastUsedPaletteItem;
    },
    setLastUsedPaletteItem(v: CommandPaletteItem | null) {
      lastUsedPaletteItem = v;
    },

    // Library
    get libraryItems() {
      return libraryItems;
    },
    setLibraryItems(
      v: Updater<{
        status: "loading" | "loaded";
        isInitialized: boolean;
        libraryItems: LibraryItems;
      }>,
    ) {
      libraryItems = applyUpdate(libraryItems, v);
    },
    get libraryItemSvgsCache() {
      return libraryItemSvgsCache;
    },
    setLibraryItemSvgsCache(v: Updater<SvgCache>) {
      libraryItemSvgsCache = applyUpdate(libraryItemSvgsCache, v);
    },

    // Scroll
    get scrollPosition() {
      return scrollPosition;
    },
    setScrollPosition(v: number) {
      scrollPosition = v;
    },

    // i18n
    get editorLangCode() {
      return editorLangCode;
    },
    setEditorLangCode(v: string) {
      editorLangCode = v;
    },

    // TTD Dialog
    get ttdRateLimits() {
      return ttdRateLimits;
    },
    setTtdRateLimits(v: RateLimits | null) {
      ttdRateLimits = v;
    },
    get ttdShowPreview() {
      return ttdShowPreview;
    },
    setTtdShowPreview(v: boolean) {
      ttdShowPreview = v;
    },
    get ttdError() {
      return ttdError;
    },
    setTtdError(v: Error | null) {
      ttdError = v;
    },
    get ttdChatHistory() {
      return ttdChatHistory;
    },
    setTtdChatHistory(v: Updater<ChatHistory>) {
      ttdChatHistory = applyUpdate(ttdChatHistory, v);
    },
    get ttdSavedChats() {
      return ttdSavedChats;
    },
    setTtdSavedChats(v: Updater<SavedChats>) {
      ttdSavedChats = applyUpdate(ttdSavedChats, v);
    },
    get ttdIsLoadingChats() {
      return ttdIsLoadingChats;
    },
    setTtdIsLoadingChats(v: boolean) {
      ttdIsLoadingChats = v;
    },
    get ttdChatsLoaded() {
      return ttdChatsLoaded;
    },
    setTtdChatsLoaded(v: boolean) {
      ttdChatsLoaded = v;
    },
  };
}

export type EditorStore = ReturnType<typeof createEditorStore>;
