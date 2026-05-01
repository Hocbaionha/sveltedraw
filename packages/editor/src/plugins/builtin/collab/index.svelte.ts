// Built-in plugin: Collab.
//
// Migrated from inline App.svelte wiring (Phase 17) into a plugin once
// the registry grew the hooks needed to host it cleanly:
//
//   - addChromeItem("top-bar"):     LiveCollaborationTrigger + status pill
//   - addChromeItem("dialog-layer"): identity capture dialog
//   - addChromeItem("toast-layer"):  connection status toasts
//   - addCanvasOverlay:              peer cursor overlay
//   - onPointerEvent("move"):        cursor broadcast (throttled)
//   - onEditorReady:                 auto-start session if URL/env configured
//   - addMutationFilter:             gate mutations by canEdit (role+zone)
//   - provideStore(COLLAB_STORE_KEY): shared store remains reachable to
//                                     other code that has the symbol
//
// The collab Y-doc / WebsocketProvider lifecycle is owned by the
// CollabStore (createCollabStore). The plugin doesn't own any of the
// network/protocol logic — it owns the editor-side wiring.

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import {
  createCollabStore,
  COLLAB_STORE_KEY,
  type CollabStore,
} from "../../../collab/store.svelte.js";
import type { IdentityResult } from "../../../components/CollabIdentityDialog.svelte";
import {
  createState,
  loadStoredIdentity,
  persistIdentity,
  makeAnonIdentity,
  resolveCollabServerUrl,
  resolveCollabRoomId,
  COLLAB_PALETTE,
  type CollabIdentity,
  type CollabToast,
} from "./state.svelte.js";
import TriggerHost, { bindTriggerHost } from "./TriggerHost.svelte";
import DialogHost, { bindDialogHost } from "./DialogHost.svelte";
import ToastHost, { bindToastHost } from "./ToastHost.svelte";
import OverlayHost, { bindOverlayHost } from "./OverlayHost.svelte";

/** Cursor broadcast cadence. Native pointermove can fire 60-1000Hz on
 *  high-rate input devices; awareness gossip every tick would melt the
 *  socket. 50ms is smooth enough that motion looks continuous and cheap
 *  enough that a 4-peer room sends ~80 msg/sec total. */
const CURSOR_BROADCAST_THROTTLE_MS = 50;

const TOAST_AUTO_DISMISS_MS = 5000;

export { COLLAB_STORE_KEY };
export type { CollabStore };

export const collabPlugin: SveltedrawPlugin = {
  id: "builtin/collab",
  install(ctx: SveltedrawPluginContext): () => void {
    const state = createState();

    // Construct the shared store. Other code (probe surface, future
    // permission filters) reach it via pluginRegistry.getStore.
    const collabStore = createCollabStore(ctx.api);
    const releaseStore = ctx.provideStore(COLLAB_STORE_KEY, collabStore);

    // ── UI bindings ──────────────────────────────────────────────────
    // Cursor overlay needs the live appState proxy (reactive zoom +
    // scroll). api.getAppState returns the proxy directly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bindOverlayHost({ appState: ctx.api.getAppState() as any });

    // Toast: store-bound. Auto-dismiss timer lives on this closure so
    // a successor toast cancels the predecessor's timer.
    let toastTimer: ReturnType<typeof setTimeout> | null = null;
    const showToast = (toast: CollabToast, ms = TOAST_AUTO_DISMISS_MS) => {
      state.toast = toast;
      if (toastTimer !== null) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        // Capture-by-identity guard: only clear if we're still showing
        // the same toast we set. Successor toasts keep their TTL.
        if (state.toast === toast) state.toast = null;
        toastTimer = null;
      }, ms);
    };
    bindToastHost({
      state,
      onClose: () => {
        if (toastTimer !== null) {
          clearTimeout(toastTimer);
          toastTimer = null;
        }
        state.toast = null;
      },
    });

    // ── Identity dialog flow ─────────────────────────────────────────
    /**
     * Start a collab session. Wraps joinRoom so the click handler and
     * auto-start share the call site.
     */
    const startSession = async (
      serverUrl: string,
      identity: CollabIdentity,
    ): Promise<void> => {
      if (collabStore.status !== "idle") return;
      try {
        await collabStore.joinRoom({
          serverUrl,
          roomId: resolveCollabRoomId(),
          // Phase 17 / A1: role hardcoded teacher until A3 ships role
          // selection. canEdit() returns true for teachers regardless
          // of zone, which is what we want for a generic 2-tab demo.
          role: "teacher",
          user: { id: identity.id, name: identity.name, color: identity.color },
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[collab] joinRoom failed:", err);
      }
    };

    const onIdentitySubmit = (result: IdentityResult): void => {
      const identity: CollabIdentity = {
        id: result.id,
        name: result.name,
        color: result.color,
      };
      if (result.persist) persistIdentity(identity);
      const serverUrl = state.pendingServerUrl;
      state.dialogOpen = false;
      state.pendingServerUrl = null;
      state.pendingAnonId = null;
      if (serverUrl) void startSession(serverUrl, identity);
    };
    const onIdentityCancel = (): void => {
      state.dialogOpen = false;
      state.pendingServerUrl = null;
      state.pendingAnonId = null;
    };
    bindDialogHost({
      state,
      palette: COLLAB_PALETTE,
      onSubmit: onIdentitySubmit,
      onCancel: onIdentityCancel,
    });

    // Trigger button + status pill at top-right.
    /**
     * Toggle handler for the LiveCollaborationTrigger. If a session is
     * active → leave. Otherwise: resolve server, then either join with
     * persisted identity (fast path) or open the identity dialog.
     * Logs a warning when no server URL is configured (the toast
     * surface is reserved for runtime errors, not config gaps).
     */
    const onTriggerClick = (): void => {
      if (collabStore.status !== "idle") {
        collabStore.leaveRoom();
        return;
      }
      const serverUrl = resolveCollabServerUrl();
      if (!serverUrl) {
        // eslint-disable-next-line no-console
        console.warn(
          "[collab] No collab server configured. Set VITE_COLLAB_SERVER " +
            "or use ?collab=ws://host:port",
        );
        return;
      }
      const stored = loadStoredIdentity();
      if (stored) {
        void startSession(serverUrl, stored);
        return;
      }
      // First-time user: prompt. Generate the anon id up front so
      // canceling and reopening doesn't churn awareness ids on retry.
      state.pendingServerUrl = serverUrl;
      state.pendingAnonId = makeAnonIdentity().id;
      state.dialogOpen = true;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appStateForWidth = ctx.api.getAppState() as any;
    bindTriggerHost({
      collabStore,
      getWidth: () => appStateForWidth.width,
      onClick: onTriggerClick,
    });

    // ── Chrome registrations ─────────────────────────────────────────
    const removeTrigger = ctx.addChromeItem({
      id: "trigger",
      slot: "top-bar",
      component: TriggerHost,
    });
    const removeDialog = ctx.addChromeItem({
      id: "dialog",
      slot: "dialog-layer",
      component: DialogHost,
    });
    const removeToast = ctx.addChromeItem({
      id: "toast",
      slot: "toast-layer",
      component: ToastHost,
    });
    const removeOverlay = ctx.addCanvasOverlay({
      id: "cursors",
      component: OverlayHost,
      // Above static/interactive canvases, below side panels.
      zIndex: 25,
      pointerEvents: false,
    });

    // ── Cursor broadcast (throttled pointermove observer) ────────────
    let lastCursorBroadcastAt = 0;
    const removePointerObs = ctx.onPointerEvent(
      "move",
      (event, sceneCoords) => {
        if (collabStore.status !== "connected") return;
        const now = performance.now();
        if (now - lastCursorBroadcastAt < CURSOR_BROADCAST_THROTTLE_MS) return;
        lastCursorBroadcastAt = now;
        // The host also gives us scene coords; pass them straight
        // through. clientX/Y kept as a fallback for any future on-
        // screen indicator that wants raw viewport position.
        collabStore.updateCursor(
          (event as PointerEvent).clientX,
          (event as PointerEvent).clientY,
          sceneCoords.x,
          sceneCoords.y,
        );
      },
    );

    // ── Connection-status toast effect ───────────────────────────────
    // We track the previous status and fire toasts only on actual
    // transitions (mid-session drop, reconnect). The initial
    // idle→connecting→connected handshake is conveyed by the button's
    // own state; firing a toast there would be noise.
    //
    // prevStatus is intentionally NOT $state — it's a back-channel
    // memo for the effect's transition detection, not a UI signal.
    let prevStatus: typeof collabStore.status = "idle";
    const removeStatusEffect = (() => {
      const eff = $effect.root(() => {
        $effect(() => {
          const cur = collabStore.status;
          const prev = prevStatus;
          prevStatus = cur;
          if (prev === "connected" && cur === "disconnected") {
            showToast({
              message: "Connection lost. Reconnecting…",
              tone: "warn",
            });
          } else if (prev === "disconnected" && cur === "connected") {
            showToast({ message: "Reconnected", tone: "ok" });
          }
        });
      });
      return eff;
    })();

    // ── Mutation gating (role-based zones) ───────────────────────────
    // canEdit returns true for teachers / non-collab sessions. The
    // gate is wired through the registry's filter chain so any
    // mutation path that calls pluginRegistry.canMutate respects it.
    // Today only a couple of paths in App.svelte do (drag start,
    // arrow-nudge, delete); future migrations of element mutators
    // can plumb in `canMutate` checks at their own gates.
    const removeMutationFilter = ctx.addMutationFilter((mctx) => {
      if (collabStore.status !== "connected") return true; // not in a session
      if (collabStore.canEdit(mctx.elementId)) return true;
      return {
        allowed: false,
        reason: `Cannot ${mctx.intent} element ${mctx.elementId}: outside your assigned zone.`,
      };
    });

    // ── Auto-start on editor ready ───────────────────────────────────
    // ?collab= URL param or VITE_COLLAB_SERVER env both auto-join with
    // persisted identity (or anon fallback) so embedded scenarios stay
    // silent. Returns a teardown that calls leaveRoom — the registry
    // runs it at uninstall.
    ctx.onEditorReady(() => {
      const autoServerUrl = resolveCollabServerUrl();
      if (autoServerUrl) {
        const identity = loadStoredIdentity() ?? makeAnonIdentity();
        void startSession(autoServerUrl, identity);
      }
      return () => {
        // Ensure we leave the room before the editor unmounts.
        collabStore.leaveRoom();
      };
    });

    return () => {
      removeStatusEffect();
      if (toastTimer !== null) {
        clearTimeout(toastTimer);
        toastTimer = null;
      }
      removeMutationFilter();
      removePointerObs();
      removeOverlay();
      removeToast();
      removeDialog();
      removeTrigger();
      releaseStore();
    };
  },
};
