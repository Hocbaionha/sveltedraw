// Multi-room Yjs collab store with role-based permissions.
// Replaces the hardcoded single-room wiring that was embedded in App.svelte.
//
// Usage:
//   const collab = createCollabStore(api)
//   await collab.joinRoom({ serverUrl, roomId, role, user })
//   collab.canEdit(elementId)

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
// @ts-ignore — resolved via Vite alias to packages/element/src
import { deepCopyElement } from "@sveltedraw/element";
import type { SveltedrawAPI } from "../api/types.js";

// Sentinel attached as the `origin` of every Y.Doc transaction we initiate
// locally. The ymap observer uses it to distinguish our own writes from
// remote peer writes (Yjs fires observers locally too) and skip the echo.
const LOCAL_ORIGIN: unique symbol = Symbol("sveltedraw-collab-local");

// Outbound coalescing window. Sveltedraw fires a scene change on every
// drag tick; without debounce we'd JSON-serialize the entire scene 60×/s.
// 80ms matches the WIP sceneSync implementation and keeps perceived
// remote latency well under one frame on a fast connection.
const PUSH_DEBOUNCE_MS = 80;

export type CollabRole = "teacher" | "student" | "viewer";

/**
 * Connection state visible to UI. Transitions:
 *   idle      → connecting   (joinRoom called)
 *   connecting → connected   (websocket "connected" status)
 *   connecting → disconnected (timeout / connection-error)
 *   connected → disconnected (network drop, mid-session)
 *   disconnected → connecting (provider auto-reconnects)
 *   any       → idle         (leaveRoom called)
 */
export type CollabStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected";

export interface CollabUser {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  role: CollabRole;
  cursor: { x: number; y: number; sceneX: number; sceneY: number } | null;
  /** frameId of the zone assigned to this student (null = no zone). */
  zone: string | null;
  activeFrame: string | null;
}

export interface JoinRoomOpts {
  serverUrl: string;
  roomId: string;
  role: CollabRole;
  user: { id: string; name: string; color: string };
}

export type CollabStore = ReturnType<typeof createCollabStore>;

export const COLLAB_STORE_KEY: unique symbol = Symbol("collabStore");

export function createCollabStore(api: SveltedrawAPI) {
  let users = $state<Map<number, CollabUser>>(new Map());
  let myRole = $state<CollabRole>("viewer");
  let myUserId = $state<string | null>(null);
  let myZone = $state<string | null>(null); // cached to avoid O(n) Map scan
  let roomId = $state<string | null>(null);
  let connected = $state(false);
  // Fine-grained connection state for the status indicator UI. `connected`
  // is kept as a backwards-compat boolean derived from this.
  let status = $state<CollabStatus>("idle");

  let provider: WebsocketProvider | null = null;
  let changeCleanup: (() => void) | null = null;
  // Cleanup for Y.js observers and awareness listeners registered in joinRoom.
  // Y.js observers survive provider.destroy() and must be explicitly removed.
  let sessionCleanup: (() => void) | null = null;

  function joinRoom(opts: JoinRoomOpts): Promise<void> {
    // Clean up previous session first.
    leaveRoom();

    return new Promise((resolve, reject) => {
      const ydoc = new Y.Doc();
      const ymap = ydoc.getMap<unknown>("elements");
      const zonesMap = ydoc.getMap<string>("zones");

      status = "connecting";
      const ws = new WebsocketProvider(opts.serverUrl, opts.roomId, ydoc);
      provider = ws;

      ws.awareness.setLocalState({
        user: opts.user,
        role: opts.role,
        cursor: null,
        zone: zonesMap.get(opts.user.id) ?? null,
        activeFrame: null,
      });

      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // Guard: if leaveRoom() was called while this Promise was in flight,
        // the state has already been reset — don't overwrite it.
        if (provider !== ws) { resolve(); return; }
        fn();
      };

      const timer = setTimeout(() => {
        settle(() => reject(new Error("Connection timed out")));
      }, 10_000);

      // Resolve on first "connected", then keep mirroring every status
      // change for the rest of the session. y-websocket emits "connecting"
      // / "connected" / "disconnected" on its own reconnect cycle.
      ws.on("status", ({ status: wsStatus }: { status: string }) => {
        if (provider !== ws) return; // stale event from torn-down session
        if (wsStatus === "connected") {
          status = "connected";
          connected = true;
          settle(() => {
            myRole = opts.role;
            myUserId = opts.user.id;
            roomId = opts.roomId;
            resolve();
          });
        } else if (wsStatus === "connecting") {
          status = "connecting";
          connected = false;
        } else if (wsStatus === "disconnected") {
          status = "disconnected";
          connected = false;
        }
      });

      ws.on("connection-error", (event: Event) => {
        if (provider === ws) status = "disconnected";
        settle(() => reject(new Error(`WebSocket connection error: ${(event as ErrorEvent).message ?? "unknown"}`)));
      });

      const onAwarenessChange = () => {
        const states = new Map<number, CollabUser>();
        ws.awareness.getStates().forEach((state: Record<string, unknown>, clientId: number) => {
          if (state.user) {
            const collabUser: CollabUser = {
              ...(state.user as { id: string; name: string; color: string }),
              role: (state.role as CollabRole) ?? "viewer",
              cursor: (state.cursor as CollabUser["cursor"]) ?? null,
              zone: (state.zone as string | null) ?? null,
              activeFrame: (state.activeFrame as string | null) ?? null,
            };
            states.set(clientId, collabUser);

            // Keep local zone in sync when the server updates our awareness.
            if (collabUser.id === opts.user.id) {
              myZone = collabUser.zone;
            }
          }
        });
        users = states;
      };
      ws.awareness.on("change", onAwarenessChange);

      // Teacher writes zone assignments into zonesMap; observe it so students
      // pick up their zone immediately without waiting for awareness gossip.
      const onZonesChange = () => {
        const frame = zonesMap.get(myUserId ?? opts.user.id) ?? null;
        myZone = frame;
        ws.awareness.setLocalStateField("zone", frame);
      };
      zonesMap.observe(onZonesChange);

      // ── Echo prevention ───────────────────────────────────────────────
      // Two replication paths must be guarded:
      //   1. Local outbound (ymap.set) fires our own ymap observer in the
      //      same tick. txn.origin === LOCAL_ORIGIN identifies the round-
      //      trip and we skip it.
      //   2. Remote inbound calls api.updateScene → bumpSceneRepaint →
      //      notifyChange → fires our api.onChange synchronously, which
      //      would push the just-applied remote state straight back. The
      //      `isApplyingRemote` flag suppresses outbound for that
      //      synchronous window.
      // `lastSyncedJson` covers the gap between "remote applied" and
      // "debounced push fires": without it, the timer reads the post-
      // apply scene and pings back an equivalent payload to peers, which
      // re-fires their observer → debounced push → ... ad nauseam.
      let isApplyingRemote = false;
      let lastSyncedJson: string | null = null;
      let pendingPushTimer: ReturnType<typeof setTimeout> | null = null;

      const pushLocalNow = (): void => {
        if (pendingPushTimer !== null) {
          clearTimeout(pendingPushTimer);
          pendingPushTimer = null;
        }
        // Plain JSON-safe copies — yjs cannot serialize Svelte $state
        // proxies, and any retained ref into the ymap would mutate the
        // shared map under our feet on the next scene tick.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload = api.getElements().map((el: any) =>
          JSON.parse(JSON.stringify(el)),
        );
        const json = JSON.stringify(payload);
        if (json === lastSyncedJson) return;
        lastSyncedJson = json;
        ydoc.transact(() => {
          ymap.set("elements", payload);
        }, LOCAL_ORIGIN);
      };

      const scheduleLocalPush = (): void => {
        if (isApplyingRemote) return;
        if (pendingPushTimer !== null) return;
        pendingPushTimer = setTimeout(() => {
          pendingPushTimer = null;
          if (isApplyingRemote) return;
          pushLocalNow();
        }, PUSH_DEBOUNCE_MS);
      };

      // Remote elements → update local scene. Skip our own writes,
      // skip no-op redeliveries, and clone refs so the ymap payload
      // isn't aliased into the live scene.
      const onYmapChange = (
        event: Y.YMapEvent<unknown>,
        txn: Y.Transaction,
      ): void => {
        if (txn.origin === LOCAL_ORIGIN) return;
        if (!event.changes.keys.has("elements")) return;
        const remote = ymap.get("elements");
        if (!Array.isArray(remote)) return;
        const incomingJson = JSON.stringify(remote);
        if (incomingJson === lastSyncedJson) return;
        lastSyncedJson = incomingJson;
        isApplyingRemote = true;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cloned = (remote as any[]).map((el) => deepCopyElement(el));
          api.updateScene({ elements: cloned });
        } finally {
          isApplyingRemote = false;
        }
      };
      ymap.observe(onYmapChange);

      // Store cleanup so leaveRoom() can unregister all observers and
      // cancel any pending debounced push (otherwise the timer would
      // fire after we've already destroyed the provider).
      sessionCleanup = () => {
        if (pendingPushTimer !== null) {
          clearTimeout(pendingPushTimer);
          pendingPushTimer = null;
        }
        zonesMap.unobserve(onZonesChange);
        ymap.unobserve(onYmapChange);
        ws.awareness.off("change", onAwarenessChange);
      };

      // Local changes → debounced broadcast inside a LOCAL_ORIGIN
      // transaction. We don't read `elements` from the callback arg —
      // pushLocalNow re-reads from the API at fire time, so coalesced
      // ticks always send the freshest scene.
      changeCleanup = api.onChange(() => {
        scheduleLocalPush();
      });
    });
  }

  function leaveRoom(): void {
    sessionCleanup?.();
    sessionCleanup = null;
    changeCleanup?.();
    changeCleanup = null;
    provider?.destroy();
    provider = null;
    connected = false;
    status = "idle";
    users = new Map();
    roomId = null;
    myRole = "viewer";
    myUserId = null;
    myZone = null;
  }

  function canEdit(elementId: string): boolean {
    if (myRole === "teacher") return true;
    if (myRole === "viewer") return false;
    // student: only elements inside their assigned zone frame.
    if (!myZone) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = api.getElements().find((e: any) => e.id === elementId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (element as any)?.frameId === myZone;
  }

  function assignZone(userId: string, frameId: string | null): void {
    if (myRole !== "teacher" || !provider) return;
    // Zone assignments are stored in a shared Y.Map keyed by userId so every
    // client can read their own zone and sync it into awareness on reconnect.
    const zonesMap = provider.doc.getMap<string>("zones");
    if (frameId === null) {
      zonesMap.delete(userId);
    } else {
      zonesMap.set(userId, frameId);
    }
    // Clients observe the zonesMap directly (see joinRoom) so they pick up
    // the assignment without any additional awareness push from us.
  }

  function updateCursor(x: number, y: number, sceneX: number, sceneY: number): void {
    if (!connected) return;
    provider?.awareness.setLocalStateField("cursor", { x, y, sceneX, sceneY });
  }

  return {
    get users() { return users; },
    get myRole() { return myRole; },
    get myUserId() { return myUserId; },
    get myZone() { return myZone; },
    get roomId() { return roomId; },
    get connected() { return connected; },
    get status() { return status; },
    joinRoom,
    leaveRoom,
    canEdit,
    assignZone,
    updateCursor,
  };
}
