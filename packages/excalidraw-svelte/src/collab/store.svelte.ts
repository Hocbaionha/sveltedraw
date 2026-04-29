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

  function joinRoom(opts: JoinRoomOpts): Promise<void> {
    // Clean up previous session first.
    leaveRoom();

    return new Promise((resolve, reject) => {
      const ydoc = new Y.Doc();
      const ymap = ydoc.getMap<unknown>("elements");

      const ws = new WebsocketProvider(opts.serverUrl, opts.roomId, ydoc);
      provider = ws;

      ws.awareness.setLocalState({
        user: opts.user,
        role: opts.role,
        cursor: null,
        zone: null,
        activeFrame: null,
      });

      // Resolve as soon as the websocket is open.
      ws.on("status", ({ status }: { status: string }) => {
        if (status === "connected") {
          myRole = opts.role;
          myUserId = opts.user.id;
          roomId = opts.roomId;
          connected = true;
          resolve();
        }
      });

      ws.on("connection-error", (err: Error) => {
        reject(err);
      });

      ws.awareness.on("change", () => {
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
      });

      // Remote elements → update local scene.
      ymap.observe(() => {
        const remote = ymap.get("elements");
        if (Array.isArray(remote)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          api.updateScene({ elements: remote as any[] });
        }
      });

      // Local changes → broadcast.
      changeCleanup = api.onChange((elements) => {
        ymap.set("elements", Array.from(elements));
      });
    });
  }

  function leaveRoom(): void {
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
    // Use a fast Map lookup if the scene exposes getElementById, otherwise
    // fall back to the linear scan via getElements().
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
    // Also push into awareness for the target client to pick up immediately.
    // We can only mutate our own awareness; other clients watch the zonesMap.
  }

  function updateCursor(x: number, y: number, sceneX: number, sceneY: number): void {
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
