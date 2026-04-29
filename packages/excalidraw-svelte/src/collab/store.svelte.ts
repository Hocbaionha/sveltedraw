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
  let roomId = $state<string | null>(null);
  let connected = $state(false);

  let provider: WebsocketProvider | null = null;
  let changeCleanup: (() => void) | null = null;

  const getMyZone = (): string | null => {
    if (!myUserId) return null;
    for (const [, user] of users) {
      if (user.id === myUserId) return user.zone;
    }
    return null;
  };

  async function joinRoom(opts: JoinRoomOpts): Promise<void> {
    // Clean up previous session.
    leaveRoom();

    const ydoc = new Y.Doc();
    const ymap = ydoc.getMap<unknown>("elements");

    provider = new WebsocketProvider(opts.serverUrl, opts.roomId, ydoc);

    provider.awareness.setLocalState({
      user: opts.user,
      role: opts.role,
      cursor: null,
      zone: null,
      activeFrame: null,
    });

    provider.awareness.on("change", () => {
      const states = new Map<number, CollabUser>();
      provider!.awareness.getStates().forEach((state: Record<string, unknown>, clientId: number) => {
        if (state.user) {
          states.set(clientId, {
            ...(state.user as { id: string; name: string; color: string }),
            role: (state.role as CollabRole) ?? "viewer",
            cursor: (state.cursor as CollabUser["cursor"]) ?? null,
            zone: (state.zone as string | null) ?? null,
            activeFrame: (state.activeFrame as string | null) ?? null,
          });
        }
      });
      users = states;
    });

    // Remote elements → update local scene.
    ymap.observe(() => {
      const remote = ymap.get("elements");
      if (Array.isArray(remote)) {
        api.updateScene({ elements: remote as AnyEl[] });
      }
    });

    // Local changes → broadcast.
    changeCleanup = api.onChange((elements) => {
      ymap.set("elements", Array.from(elements));
    });

    myRole = opts.role;
    myUserId = opts.user.id;
    roomId = opts.roomId;
    connected = true;
  }

  function leaveRoom(): void {
    changeCleanup?.();
    changeCleanup = null;
    provider?.destroy();
    provider = null;
    connected = false;
    users = new Map();
    roomId = null;
  }

  function canEdit(elementId: string): boolean {
    if (myRole === "teacher") return true;
    if (myRole === "viewer") return false;
    // student: only elements inside their assigned zone frame.
    const myZone = getMyZone();
    if (!myZone) return false;
    const element = api.getElements().find((e) => e.id === elementId);
    return (element as Record<string, unknown>)?.["frameId"] === myZone;
  }

  function assignZone(userId: string, frameId: string | null): void {
    if (myRole !== "teacher" || !provider) return;
    // Find the client ID for the given userId and update their awareness zone.
    provider.awareness.getStates().forEach((state: Record<string, unknown>, clientId: number) => {
      if ((state.user as { id?: string })?.id === userId) {
        // We can only set our own local state. Zone assignment goes through
        // a shared document entry instead.
        const zonesMap = provider!.doc.getMap<string>("zones");
        if (frameId === null) {
          zonesMap.delete(userId);
        } else {
          zonesMap.set(userId, frameId);
        }
      }
    });
  }

  function updateCursor(x: number, y: number, sceneX: number, sceneY: number): void {
    provider?.awareness.setLocalStateField("cursor", { x, y, sceneX, sceneY });
  }

  return {
    get users() { return users; },
    get myRole() { return myRole; },
    get myUserId() { return myUserId; },
    get roomId() { return roomId; },
    get connected() { return connected; },
    joinRoom,
    leaveRoom,
    canEdit,
    assignZone,
    updateCursor,
  };
}
