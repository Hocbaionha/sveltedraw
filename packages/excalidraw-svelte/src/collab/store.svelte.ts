// Multi-room Yjs collab store with role-based permissions.
// Replaces the hardcoded single-room wiring that was embedded in App.svelte.
//
// Usage:
//   const collab = createCollabStore(api)
//   await collab.joinRoom({ serverUrl, roomId, role, user })
//   collab.canEdit(elementId)

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type { SveltedrawAPI } from "../api/types.js";

export type CollabRole = "teacher" | "student" | "viewer";

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

      // Resolve as soon as the websocket is open.
      ws.on("status", ({ status }: { status: string }) => {
        if (status === "connected") {
          settle(() => {
            myRole = opts.role;
            myUserId = opts.user.id;
            roomId = opts.roomId;
            connected = true;
            resolve();
          });
        }
      });

      ws.on("connection-error", (event: Event) => {
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

      // Remote elements → update local scene.
      const onYmapChange = () => {
        const remote = ymap.get("elements");
        if (Array.isArray(remote)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          api.updateScene({ elements: remote as any[] });
        }
      };
      ymap.observe(onYmapChange);

      // Store cleanup so leaveRoom() can unregister all observers.
      sessionCleanup = () => {
        zonesMap.unobserve(onZonesChange);
        ymap.unobserve(onYmapChange);
        ws.awareness.off("change", onAwarenessChange);
      };

      // Local changes → broadcast.
      changeCleanup = api.onChange((elements) => {
        ymap.set("elements", Array.from(elements));
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
    joinRoom,
    leaveRoom,
    canEdit,
    assignZone,
    updateCursor,
  };
}
