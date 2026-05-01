// Unit tests for the Tier-2 plugin extension surface.
//
// Covers the registry-side dispatch logic for the four hooks added in
// the Tier 2 commit: registerTool / onWindowEvent / onElementChange /
// addMutationFilter. The host wiring (App.svelte) is exercised by
// the corresponding CDP smoke; this file proves the registry
// implementation in isolation.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PluginRegistry } from "./registry.svelte.ts";
import type { ToolPluginDef } from "./types.ts";

// Stub api / tunnels — registry.buildContext only forwards them. We
// keep the shape minimal; the tests don't exercise api methods.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stubApi: any = {
  onChange: () => () => {},
  onSelectionChange: () => () => {},
  onToolChange: () => () => {},
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stubTunnels: any = {};
const noBridgeStore = (): undefined => undefined;

let registry: PluginRegistry;

beforeEach(() => {
  registry = new PluginRegistry();
});

describe("registerTool / pointer dispatch", () => {
  it("routes pointerdown to the registered tool when active and the tool claims the gesture", () => {
    const ctx = registry.buildContext("test-plugin", stubApi, stubTunnels, noBridgeStore);
    const onPointerDown = vi.fn();
    const def: ToolPluginDef = {
      name: "highlighter",
      onPointerDown,
    };
    ctx.registerTool(def);

    const claimed = registry.dispatchToolPointerDown("highlighter", (passthrough) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event: { pointerId: 1 } as any,
      sceneX: 10,
      sceneY: 20,
      hitElement: null,
      passthrough,
      pushHistory: () => {},
      bumpSceneRepaint: () => {},
    }));

    expect(claimed).toBe(true);
    expect(onPointerDown).toHaveBeenCalledOnce();
  });

  it("releases the gesture claim when onPointerDown calls passthrough()", () => {
    const ctx = registry.buildContext("test-plugin", stubApi, stubTunnels, noBridgeStore);
    ctx.registerTool({
      name: "passive",
      onPointerDown: (toolCtx) => {
        toolCtx.passthrough();
      },
      onPointerMove: vi.fn(),
    });

    const claimed = registry.dispatchToolPointerDown("passive", (passthrough) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event: { pointerId: 1 } as any,
      sceneX: 0, sceneY: 0, hitElement: null,
      passthrough,
      pushHistory: () => {}, bumpSceneRepaint: () => {},
    }));
    expect(claimed).toBe(false);

    // Subsequent move should NOT route to this tool — claim was lifted.
    const moveHandled = registry.dispatchToolPointerMove((passthrough) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event: { pointerId: 1 } as any,
      sceneX: 0, sceneY: 0, hitElement: null,
      passthrough,
      pushHistory: () => {}, bumpSceneRepaint: () => {},
    }));
    expect(moveHandled).toBe(false);
  });

  it("returns false when no tool plugin is registered for the active name", () => {
    const claimed = registry.dispatchToolPointerDown("nonexistent", (passthrough) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event: { pointerId: 1 } as any,
      sceneX: 0, sceneY: 0, hitElement: null,
      passthrough,
      pushHistory: () => {}, bumpSceneRepaint: () => {},
    }));
    expect(claimed).toBe(false);
  });

  it("releases gesture state on pointerup", () => {
    const ctx = registry.buildContext("test-plugin", stubApi, stubTunnels, noBridgeStore);
    const moveSpy = vi.fn();
    ctx.registerTool({
      name: "draw",
      onPointerDown: () => {},
      onPointerMove: moveSpy,
      onPointerUp: () => {},
    });

    const buildCtx = (passthrough: () => void) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event: { pointerId: 1 } as any,
      sceneX: 0, sceneY: 0, hitElement: null,
      passthrough,
      pushHistory: () => {}, bumpSceneRepaint: () => {},
    });

    registry.dispatchToolPointerDown("draw", buildCtx); // claims
    registry.dispatchToolPointerUp(buildCtx);            // releases

    // After pointerup, the claim is gone — moves shouldn't dispatch.
    const handled = registry.dispatchToolPointerMove(buildCtx);
    expect(handled).toBe(false);
    expect(moveSpy).not.toHaveBeenCalled();
  });

  it("fires onActivate / onDeactivate via notifyToolChange", () => {
    const ctx = registry.buildContext("test-plugin", stubApi, stubTunnels, noBridgeStore);
    const activate = vi.fn();
    const deactivate = vi.fn();
    ctx.registerTool({
      name: "ink",
      onActivate: activate,
      onDeactivate: deactivate,
    });
    registry.notifyToolChange(null, "ink");
    expect(activate).toHaveBeenCalledOnce();
    registry.notifyToolChange("ink", "selection");
    expect(deactivate).toHaveBeenCalledOnce();
  });

  it("throws on duplicate tool name registration", () => {
    const ctx = registry.buildContext("p1", stubApi, stubTunnels, noBridgeStore);
    ctx.registerTool({ name: "dup" });
    expect(() => ctx.registerTool({ name: "dup" })).toThrow(/already registered/);
  });

  it("a throwing tool handler doesn't crash dispatch (logs + treats as passthrough)", () => {
    const ctx = registry.buildContext("test", stubApi, stubTunnels, noBridgeStore);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    ctx.registerTool({
      name: "broken",
      onPointerDown: () => { throw new Error("boom"); },
    });

    const claimed = registry.dispatchToolPointerDown("broken", (passthrough) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event: { pointerId: 1 } as any,
      sceneX: 0, sceneY: 0, hitElement: null,
      passthrough,
      pushHistory: () => {}, bumpSceneRepaint: () => {},
    }));
    expect(claimed).toBe(false); // throw treated as no-claim
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("[plugin:tool:broken]"),
      expect.any(Error),
    );
    errSpy.mockRestore();
  });
});

describe("onWindowEvent", () => {
  it("attaches a window listener lazily on first observer + dispatches to multiple", () => {
    const ctx = registry.buildContext("p", stubApi, stubTunnels, noBridgeStore);
    const obs1 = vi.fn();
    const obs2 = vi.fn();
    const dispose1 = ctx.onWindowEvent("paste", obs1);
    const dispose2 = ctx.onWindowEvent("paste", obs2);

    window.dispatchEvent(new Event("paste"));
    expect(obs1).toHaveBeenCalledOnce();
    expect(obs2).toHaveBeenCalledOnce();

    dispose1();
    window.dispatchEvent(new Event("paste"));
    expect(obs1).toHaveBeenCalledOnce(); // still 1
    expect(obs2).toHaveBeenCalledTimes(2);

    dispose2();
    // After the last observer disposed, the underlying listener
    // detaches — subsequent events are no-ops for this registry.
    window.dispatchEvent(new Event("paste"));
    expect(obs2).toHaveBeenCalledTimes(2);
  });

  it("isolates a throwing observer from the rest", () => {
    const ctx = registry.buildContext("p", stubApi, stubTunnels, noBridgeStore);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ok = vi.fn();
    ctx.onWindowEvent("online", () => { throw new Error("boom"); });
    ctx.onWindowEvent("online", ok);
    window.dispatchEvent(new Event("online"));
    expect(ok).toHaveBeenCalledOnce();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("onElementChange", () => {
  it("dispatches to every registered observer", () => {
    const ctx = registry.buildContext("p", stubApi, stubTunnels, noBridgeStore);
    const a = vi.fn();
    const b = vi.fn();
    ctx.onElementChange(a);
    ctx.onElementChange(b);
    registry.dispatchElementChange({
      id: "e1",
      current: { id: "e1", x: 1 },
      previous: { id: "e1", x: 0 },
    });
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it("dispose unregisters", () => {
    const ctx = registry.buildContext("p", stubApi, stubTunnels, noBridgeStore);
    const obs = vi.fn();
    const dispose = ctx.onElementChange(obs);
    dispose();
    registry.dispatchElementChange({ id: "e1", current: null, previous: null });
    expect(obs).not.toHaveBeenCalled();
  });
});

describe("addMutationFilter (Tier-1, smoke for compose semantics)", () => {
  it("multiple filters compose AND-style — any false blocks", () => {
    const ctx = registry.buildContext("p", stubApi, stubTunnels, noBridgeStore);
    ctx.addMutationFilter(() => true);
    ctx.addMutationFilter(() => ({ allowed: false, reason: "no" }));
    ctx.addMutationFilter(() => true);
    const allowed = registry.canMutate({ elementId: "x", intent: "move" });
    expect(allowed).toBe(false);
  });

  it("returns true when no filters installed", () => {
    expect(registry.canMutate({ elementId: "x", intent: "create" })).toBe(true);
  });
});
