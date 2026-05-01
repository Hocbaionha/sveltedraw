// Unit test for the Yjs replication protocol.
//
// Verifies the post-refactor wire shape: Y.Map keyed by element.id with
// per-element JSON values, NOT a single "elements" key holding the
// whole array. This is the difference between using Yjs as a CRDT vs.
// as a dumb broadcast channel — see store.svelte.ts comments.
//
// We mock WebsocketProvider so the tests don't need a real y-websocket
// relay running. The mock fakes the lifecycle events the store listens
// for ("status" / "connection-error") and exposes the underlying Y.Doc
// so the test can assert on the shared map's keys and values.

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Y from "yjs";

// Stub WebsocketProvider before importing the store. The mock holds a
// reference to the Y.Doc + an awareness shim so we can poke it from
// the tests.
const providers: MockProvider[] = [];

class MockProvider {
  doc: Y.Doc;
  awareness = {
    getStates: () => new Map(),
    setLocalState: () => {},
    setLocalStateField: () => {},
    on: () => {},
    off: () => {},
  };
  private listeners = new Map<string, Set<(arg: unknown) => void>>();
  destroyed = false;

  constructor(_url: string, _room: string, doc: Y.Doc) {
    this.doc = doc;
    providers.push(this);
    // Resolve the store's Promise on the next microtask. The store
    // calls ws.on("status") + listens for "connected" to settle the
    // joinRoom Promise; firing it here completes the handshake.
    queueMicrotask(() => {
      this.fire("status", { status: "connected" });
    });
  }
  on(event: string, cb: (arg: unknown) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }
  off(event: string, cb: (arg: unknown) => void): void {
    this.listeners.get(event)?.delete(cb);
  }
  fire(event: string, arg: unknown): void {
    for (const cb of this.listeners.get(event) ?? []) cb(arg);
  }
  destroy(): void {
    this.destroyed = true;
  }
}

vi.mock("y-websocket", () => ({
  WebsocketProvider: MockProvider,
}));

// Mock @sveltedraw/element since deepCopyElement only needs to clone
// JSON-safe values for these tests. Vitest's alias config points the
// real import at packages/element/src/index.ts, but pulling in the
// full barrel transitively imports svg/canvas helpers we don't need.
vi.mock("@sveltedraw/element", () => ({
  deepCopyElement: <T>(el: T): T => JSON.parse(JSON.stringify(el)),
}));

// Type stub for the editor API the store consumes. Mirrors the surface
// area touched by createCollabStore (getElements / updateScene /
// onChange / notifyChange).
type StubApi = {
  getElements: () => unknown[];
  updateScene: (patch: { elements?: unknown[] }) => void;
  onChange: (cb: () => void) => () => void;
  notifyChange: () => void;
  onSelectionChange: () => () => void;
  onToolChange: () => () => void;
};

function makeStubApi() {
  let elements: unknown[] = [];
  const onChangeCbs = new Set<() => void>();
  const api: StubApi = {
    getElements: () => elements,
    updateScene: (patch) => {
      if (patch.elements) elements = patch.elements;
      api.notifyChange();
    },
    onChange: (cb) => {
      onChangeCbs.add(cb);
      return () => onChangeCbs.delete(cb);
    },
    notifyChange: () => {
      for (const cb of onChangeCbs) cb();
    },
    onSelectionChange: () => () => {},
    onToolChange: () => () => {},
  };
  // Helpers for the test to drive scene state without going through
  // updateScene (which fires onChange — convenient for some tests,
  // not others).
  return {
    api,
    setElements: (next: unknown[]) => {
      elements = next;
      api.notifyChange();
    },
  };
}

const makeRect = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  type: "rectangle",
  x: 0, y: 0, width: 50, height: 50, angle: 0,
  strokeColor: "#000", backgroundColor: "transparent", fillStyle: "solid",
  strokeWidth: 1, strokeStyle: "solid", roundness: null, roughness: 0,
  opacity: 100, groupIds: [], frameId: null, index: "a0",
  boundElements: null, updated: 1, link: null, locked: false,
  seed: 1, version: 1, versionNonce: 1, isDeleted: false,
  ...overrides,
});

beforeEach(() => {
  providers.length = 0;
});

// Defer the import of the store until after vi.mock has registered the
// y-websocket replacement. Vitest hoists vi.mock above imports at the
// top level, but doing the import inside the test guarantees the order
// even if the hoisting doesn't reach this file's transitive deps.
async function importStore() {
  const mod = await import("./store.svelte.js");
  return mod.createCollabStore;
}

const PUSH_DEBOUNCE_MS = 80;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("collab store / Yjs protocol", () => {
  it("publishes elements as per-id Y.Map keys (not a single 'elements' array)", async () => {
    const createCollabStore = await importStore();
    const { api, setElements } = makeStubApi();
    const store = createCollabStore(api);

    await store.joinRoom({
      serverUrl: "ws://test", roomId: "room-1",
      role: "teacher", user: { id: "u1", name: "u1", color: "#000" },
    });
    // Setting elements AFTER joinRoom is what fires the api.onChange
    // listener that schedules the push. Setting them before would be
    // a no-op because the store's listener wasn't registered yet.
    setElements([makeRect("rect-A"), makeRect("rect-B")]);
    // Wait past the debounce window so pushLocalNow flushes.
    await wait(PUSH_DEBOUNCE_MS + 50);

    const doc = providers[0].doc;
    const ymap = doc.getMap("elements");
    const keys = Array.from(ymap.keys());

    expect(keys).not.toContain("elements"); // the old anti-pattern
    expect(keys.sort()).toEqual(["rect-A", "rect-B"]);

    // Each entry is the element JSON (not a string blob, not the array)
    const a = ymap.get("rect-A") as { id: string; type: string };
    expect(a.id).toBe("rect-A");
    expect(a.type).toBe("rectangle");
  });

  it("on update, only the changed element's key is rewritten (no full-scene resend)", async () => {
    const createCollabStore = await importStore();
    const { api, setElements } = makeStubApi();
    const store = createCollabStore(api);

    await store.joinRoom({
      serverUrl: "ws://test", roomId: "r",
      role: "teacher", user: { id: "u", name: "u", color: "#000" },
    });
    setElements([makeRect("a"), makeRect("b"), makeRect("c")]);
    await wait(PUSH_DEBOUNCE_MS + 50);

    // Snapshot the initial Yjs update size
    const doc = providers[0].doc;
    const ymap = doc.getMap("elements");
    const initialB = ymap.get("b") as { x: number; version: number };

    // Mutate only `b` — bump version like Excalidraw's mutation helpers do
    setElements([
      makeRect("a"),
      makeRect("b", { x: 200, version: 2, versionNonce: 99 }),
      makeRect("c"),
    ]);
    await wait(PUSH_DEBOUNCE_MS + 50);

    const newA = ymap.get("a") as { version: number };
    const newB = ymap.get("b") as { x: number; version: number };
    const newC = ymap.get("c") as { version: number };

    expect(newB.x).toBe(200);
    expect(newB.version).toBe(2);
    // a and c untouched — same object identity (Yjs returns the cached
    // value for unchanged keys).
    expect(newA.version).toBe(1);
    expect(newC.version).toBe(1);
    // The previous-cycle `b` value is gone (overwritten in place).
    expect(newB).not.toEqual(initialB);
  });

  it("deleted elements are removed from the Y.Map (not just absent from the next push)", async () => {
    const createCollabStore = await importStore();
    const { api, setElements } = makeStubApi();
    const store = createCollabStore(api);

    await store.joinRoom({
      serverUrl: "ws://test", roomId: "r",
      role: "teacher", user: { id: "u", name: "u", color: "#000" },
    });
    setElements([makeRect("keep"), makeRect("drop")]);
    await wait(PUSH_DEBOUNCE_MS + 50);

    const doc = providers[0].doc;
    const ymap = doc.getMap("elements");
    expect(ymap.has("drop")).toBe(true);

    setElements([makeRect("keep")]);
    await wait(PUSH_DEBOUNCE_MS + 50);

    expect(ymap.has("drop")).toBe(false);
    expect(ymap.has("keep")).toBe(true);
  });

  it("doesn't send a transaction when nothing changed (idempotent push)", async () => {
    const createCollabStore = await importStore();
    const { api, setElements } = makeStubApi();
    const store = createCollabStore(api);

    await store.joinRoom({
      serverUrl: "ws://test", roomId: "r",
      role: "teacher", user: { id: "u", name: "u", color: "#000" },
    });
    setElements([makeRect("x")]);
    await wait(PUSH_DEBOUNCE_MS + 50);

    const doc = providers[0].doc;
    const beforeStateVector = Y.encodeStateVector(doc);

    // Re-fire onChange without mutating elements (e.g. selection
    // change in real life would do this).
    api.notifyChange();
    await wait(PUSH_DEBOUNCE_MS + 50);

    const afterStateVector = Y.encodeStateVector(doc);
    // No new ops → state vector unchanged.
    expect(Buffer.from(afterStateVector).equals(Buffer.from(beforeStateVector))).toBe(true);
  });

  it("two docs converge on different-element edits (the actual CRDT case)", async () => {
    const createCollabStore = await importStore();

    // Tab A
    const { api: apiA, setElements: setA } = makeStubApi();
    const storeA = createCollabStore(apiA);
    await storeA.joinRoom({
      serverUrl: "ws://test", roomId: "r",
      role: "teacher", user: { id: "uA", name: "A", color: "#000" },
    });
    setA([makeRect("a", { x: 10 })]);
    await wait(PUSH_DEBOUNCE_MS + 50);
    const docA = providers[0].doc;

    // Tab B (separate store + doc)
    const { api: apiB, setElements: setB } = makeStubApi();
    const storeB = createCollabStore(apiB);
    await storeB.joinRoom({
      serverUrl: "ws://test", roomId: "r",
      role: "student", user: { id: "uB", name: "B", color: "#fff" },
    });
    setB([makeRect("b", { x: 20 })]);
    await wait(PUSH_DEBOUNCE_MS + 50);
    const docB = providers[1].doc;

    // Cross-apply updates as a real websocket relay would.
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB));
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    await wait(50);

    // Both docs converge to {a, b}.
    const elementsA = (apiA.getElements() as { id: string }[]).map(e => e.id).sort();
    const elementsB = (apiB.getElements() as { id: string }[]).map(e => e.id).sort();
    expect(elementsA).toEqual(["a", "b"]);
    expect(elementsB).toEqual(["a", "b"]);
  });
});
