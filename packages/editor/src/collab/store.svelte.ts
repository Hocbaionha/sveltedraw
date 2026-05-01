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

  // Monotonic session token. Incremented on every joinRoom() so any
  // callback that captured an older value can detect "I'm from a stale
  // session" without relying solely on `provider !== ws` (which holds
  // for ws-vs-doc identity but doesn't help when provider is briefly
  // null between leaveRoom and the next joinRoom). Every async / event
  // callback that touches store state checks this token first.
  let sessionToken = 0;

  function joinRoom(opts: JoinRoomOpts): Promise<void> {
    // Clean up previous session first.
    leaveRoom();
    const mySession = ++sessionToken;
    const isStaleSession = (): boolean => mySession !== sessionToken;

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
        // Guard: if leaveRoom() (or another joinRoom) ran while this
        // Promise was in flight, the state has already been reset —
        // don't overwrite it. The session-token check catches the
        // case where provider has been reassigned to a fresh ws
        // between the trigger event and this settle.
        if (isStaleSession() || provider !== ws) { resolve(); return; }
        fn();
      };

      const timer = setTimeout(() => {
        settle(() => {
          leaveRoom();
          reject(new Error("Connection timed out"));
        });
      }, 10_000);

      // Resolve on first "connected", then keep mirroring every status
      // change for the rest of the session. y-websocket emits "connecting"
      // / "connected" / "disconnected" on its own reconnect cycle.
      ws.on("status", ({ status: wsStatus }: { status: string }) => {
        if (isStaleSession() || provider !== ws) return; // stale event from torn-down session
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
        if (!isStaleSession() && provider === ws) status = "disconnected";
        settle(() => {
          // Tear down everything attached to this aborted session before
          // we hand the rejection up. Without this the awareness/zone
          // observers registered below would leak (they survive
          // provider.destroy()), and the change-listener attached to the
          // api on the resolve path can dangle if the ordering shifts.
          leaveRoom();
          reject(new Error(`WebSocket connection error: ${(event as ErrorEvent).message ?? "unknown"}`));
        });
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

      // ── Replication protocol ─────────────────────────────────────────
      // The Y.Map is keyed by element.id, value = element JSON. This is
      // the difference between using Yjs as a CRDT vs a dumb broadcast
      // channel:
      //
      //   - Per-element granularity: ymap.set(id, json) on each changed
      //     element. Yjs transmits only the deltas, not the whole scene.
      //   - Concurrent edits on different elements merge automatically
      //     (Y.Map gives us per-key LWW; different keys never collide).
      //   - Bandwidth scales with change size, not scene size. Editing
      //     one element in a 5k-element doc sends ~1KB instead of ~500KB.
      //   - Yjs internal doc deltas stay small; reconnect catches up
      //     via standard Yjs sync without a full snapshot.
      //
      // Same-element concurrent edits still last-writer-wins (per-key,
      // not per-field) — acceptable for shapes where conflict resolution
      // is fundamentally ambiguous (which X coord wins when both peers
      // drag?). Field-level merging would require Y.Map<id, Y.Map<field>>
      // — a Phase-2 refactor; this commit fixes the obviously-broken
      // wire protocol first.
      //
      // Two echo-suppression paths still apply:
      //   1. Local outbound writes are wrapped in a transact() with
      //      LOCAL_ORIGIN; observer skips matching txns.
      //   2. Remote inbound calls api.updateScene → fires api.onChange
      //      synchronously, which would re-broadcast. The
      //      `isApplyingRemote` flag suppresses outbound for that
      //      synchronous window.
      //
      // No more whole-scene fingerprinting: per-key changes naturally
      // dedupe via the LOCAL_ORIGIN guard (round-trip echoes hit the
      // guard before reaching the apply path). The localSnapshot map
      // tracks per-element fingerprints so pushLocalNow knows what
      // actually changed since the last push.
      let isApplyingRemote = false;
      let pendingPushTimer: ReturnType<typeof setTimeout> | null = null;

      // Per-element fingerprint of the last-known shared state. After a
      // local push or a remote receive we update this so the next push
      // computes a minimal diff. The fingerprint covers the fields that
      // actually drive rendering — version + versionNonce make any non-
      // trivial mutation flip the digest, since Excalidraw's mutation
      // helpers bump those on every change.
      const localSnapshot = new Map<string, string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fingerprintEl = (e: any): string =>
        e.type + "|" + e.x + "," + e.y + "|" + e.width + "x" + e.height
        + "|" + e.angle + "|" + e.version + "|" + e.versionNonce
        + "|" + (e.isDeleted ? 1 : 0);

      const pushLocalNow = (): void => {
        if (pendingPushTimer !== null) {
          clearTimeout(pendingPushTimer);
          pendingPushTimer = null;
        }
        if (isStaleSession() || provider !== ws) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const live = api.getElements() as any[];
        // Compute the diff in a single pass: ids that changed need
        // ymap.set, ids that disappeared need ymap.delete.
        const liveIds = new Set<string>();
        const toSet: { id: string; payload: unknown; fp: string }[] = [];
        for (const el of live) {
          liveIds.add(el.id);
          const fp = fingerprintEl(el);
          if (localSnapshot.get(el.id) === fp) continue;
          // Plain JSON-safe copies — Yjs can't serialize Svelte $state
          // proxies, and a live ref aliased into the ymap would mutate
          // the shared map under our feet on the next scene tick.
          toSet.push({ id: el.id, payload: JSON.parse(JSON.stringify(el)), fp });
        }
        const toDelete: string[] = [];
        for (const id of localSnapshot.keys()) {
          if (!liveIds.has(id)) toDelete.push(id);
        }
        if (toSet.length === 0 && toDelete.length === 0) return;
        ydoc.transact(() => {
          for (const { id, payload } of toSet) ymap.set(id, payload);
          for (const id of toDelete) ymap.delete(id);
        }, LOCAL_ORIGIN);
        // Update the snapshot AFTER the successful transact so a thrown
        // serialization (e.g. cyclic ref) doesn't leave the snapshot
        // claiming we synced state we didn't actually push.
        for (const { id, fp } of toSet) localSnapshot.set(id, fp);
        for (const id of toDelete) localSnapshot.delete(id);
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

      // Apply per-key remote changes. Y.Map's `event.changes.keys` is
      // a Map<key, { action: "add" | "update" | "delete", oldValue }>
      // — the surgical alternative to "diff the entire array".
      const onYmapChange = (
        event: Y.YMapEvent<unknown>,
        txn: Y.Transaction,
      ): void => {
        if (txn.origin === LOCAL_ORIGIN) return;
        if (event.changes.keys.size === 0) return;

        // Build the new local element set. We rebuild from the full
        // ymap (not just the delta) so element ordering by `index`
        // stays consistent — the scene's getElements is order-
        // sensitive (z-order) and applying a partial delta would
        // require us to re-derive the order ourselves.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const all: any[] = [];
        ymap.forEach((value) => {
          if (value && typeof value === "object") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            all.push(deepCopyElement(value as any));
          }
        });
        // Excalidraw uses fractional indexing on .index for stable
        // z-order. Sort here so the local scene matches the canonical
        // ordering across peers.
        all.sort((a, b) => {
          const ai = a.index ?? "";
          const bi = b.index ?? "";
          return ai < bi ? -1 : ai > bi ? 1 : 0;
        });

        isApplyingRemote = true;
        try {
          api.updateScene({ elements: all });
        } finally {
          isApplyingRemote = false;
        }

        // Re-sync localSnapshot from the LOCAL scene post-apply.
        // updateScene may bump version/versionNonce on the way through
        // restoreElements; if we synced from the ymap entry instead
        // we'd see a phantom "local diff" on the next push and re-
        // broadcast our own normalized version — an echo loop.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const livePost = api.getElements() as any[];
        const liveIds = new Set<string>();
        for (const el of livePost) {
          liveIds.add(el.id);
          localSnapshot.set(el.id, fingerprintEl(el));
        }
        for (const id of localSnapshot.keys()) {
          if (!liveIds.has(id)) localSnapshot.delete(id);
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
        // Drop the per-element snapshot — the next session has a
        // different doc identity and a stale snapshot would suppress
        // legitimate first-pushes after rejoin.
        localSnapshot.clear();
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
    // Bump the session token so any pending callbacks captured in the
    // outgoing session see isStaleSession() === true and bail before
    // mutating store state.
    sessionToken++;
    sessionCleanup?.();
    sessionCleanup = null;
    changeCleanup?.();
    changeCleanup = null;
    // Tear down the lazy frameId cache and its api.onChange listener.
    // Without this each leave/rejoin cycle accrues another listener
    // on the api, and the cache itself stays alive holding refs.
    frameIdCacheClear?.();
    frameIdCacheClear = null;
    frameIdCache = null;
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

  // id → frameId index, rebuilt on demand only when the scene changes.
  // canEdit can fire many times per drag tick in a student-role room
  // (one call per affected element); the previous implementation did a
  // linear .find through the full element array per call, giving O(N²)
  // on big scenes. The cache invalidates on every scene change and
  // rebuilds lazily on the next read.
  let frameIdCache: Map<string, string | null> | null = null;
  let frameIdCacheClear: (() => void) | null = null;
  const getFrameIdMap = (): Map<string, string | null> => {
    if (frameIdCache) return frameIdCache;
    const m = new Map<string, string | null>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const el of api.getElements() as any[]) {
      m.set(el.id, el.frameId ?? null);
    }
    frameIdCache = m;
    if (!frameIdCacheClear) {
      frameIdCacheClear = api.onChange(() => {
        frameIdCache = null;
      });
    }
    return m;
  };

  function canEdit(elementId: string): boolean {
    if (myRole === "teacher") return true;
    if (myRole === "viewer") return false;
    // student: only elements inside their assigned zone frame.
    if (!myZone) return false;
    return getFrameIdMap().get(elementId) === myZone;
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
