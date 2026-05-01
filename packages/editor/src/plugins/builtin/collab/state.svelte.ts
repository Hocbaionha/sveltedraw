// Plugin-local state for the collab plugin.
//
// The collab store itself is owned by the plugin (constructed in
// install + provided via COLLAB_STORE_KEY) so other code that has
// the symbol can still reach it. This file just holds the UI / dialog
// / toast state that doesn't belong to the store.

export type CollabPaletteColor = string;

export type CollabIdentity = {
  id: string;
  name: string;
  color: string;
};

export type CollabToast = {
  message: string;
  tone: "info" | "warn" | "ok";
};

export type CollabPluginState = {
  /** Identity-capture dialog open/closed. */
  dialogOpen: boolean;
  /** Server URL captured at button-click time so the dialog's submit
   *  handler knows where to connect. Reset on close/cancel. */
  pendingServerUrl: string | null;
  /** Stable anon id offered as the dialog's default. Re-used on
   *  cancel-then-reopen so awareness ids don't churn. */
  pendingAnonId: string | null;
  /** Live toast (mid-session drop / reconnect notifications). */
  toast: CollabToast | null;
};

export const COLLAB_PALETTE: readonly CollabPaletteColor[] = [
  "#1971c2", // blue
  "#2f9e44", // green
  "#e67700", // amber
  "#c92a2a", // red
  "#9c36b5", // purple
  "#0c8599", // teal
  "#e8590c", // orange
  "#5f3dc4", // indigo
];

export function createState(): CollabPluginState {
  const s: CollabPluginState = $state({
    dialogOpen: false,
    pendingServerUrl: null,
    pendingAnonId: null,
    toast: null,
  });
  return s;
}

export const COLLAB_IDENTITY_STORAGE_KEY = "sveltedraw-collab-identity";

/**
 * Read persisted identity from localStorage. Returns null on first
 * run / corrupted JSON / SSR. Caller handles the null path (anon
 * fallback or prompt the dialog).
 */
export function loadStoredIdentity(): CollabIdentity | null {
  try {
    const raw = window.localStorage.getItem(COLLAB_IDENTITY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.id === "string" &&
      typeof parsed?.name === "string" &&
      typeof parsed?.color === "string"
    ) {
      return parsed as CollabIdentity;
    }
  } catch { /* swallow corrupt JSON / quota error */ }
  return null;
}

export function persistIdentity(identity: CollabIdentity): void {
  try {
    window.localStorage.setItem(
      COLLAB_IDENTITY_STORAGE_KEY,
      JSON.stringify(identity),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[collab] persist identity failed", err);
  }
}

/**
 * Generate an ephemeral anonymous identity for users who join without
 * going through the dialog (auto-start via URL). crypto.randomUUID
 * gives us full 128-bit space; the previous 4-hex slug hit the
 * birthday bound at ~256 users and caused awareness-key collisions.
 * Display label still uses the short slug for readability.
 */
export function makeAnonIdentity(): CollabIdentity {
  const uuid =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof crypto !== "undefined" && (crypto as any).randomUUID
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (crypto as any).randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  const slug = uuid.slice(0, 4).toUpperCase();
  const color = COLLAB_PALETTE[Math.floor(Math.random() * COLLAB_PALETTE.length)];
  return {
    id: `anon-${uuid}`,
    name: `Guest ${slug}`,
    color,
  };
}

/**
 * Read collab params from the URL. Sveltedraw runs under a hash router
 * (#app), so query params usually live inside the hash fragment
 * (`#app?collab=ws://...`). Check both top-level and hash so either
 * form works.
 */
export function readCollabUrlParam(name: string): string | null {
  try {
    const url = new URL(window.location.href);
    const top = url.searchParams.get(name);
    if (top) return top;
    const hash = url.hash || "";
    const qIdx = hash.indexOf("?");
    if (qIdx === -1) return null;
    return new URLSearchParams(hash.slice(qIdx + 1)).get(name);
  } catch {
    return null;
  }
}

/**
 * Resolve the collab server URL. Priority: ?collab=... query param
 * over VITE_COLLAB_SERVER env over null (no auto-start).
 */
export function resolveCollabServerUrl(): string | null {
  const fromUrl = readCollabUrlParam("collab");
  if (fromUrl) return fromUrl;
  const fromEnv = import.meta.env.VITE_COLLAB_SERVER as string | undefined;
  return fromEnv || null;
}

export function resolveCollabRoomId(): string {
  return readCollabUrlParam("room") ?? "sveltedraw-default";
}
