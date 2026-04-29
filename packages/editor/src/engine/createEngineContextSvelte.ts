/**
 * createEngineContextSvelte.ts — Phase 6 batch 1 stub.
 *
 * Parallel to packages/engine/engine/engineContextFactory.ts (React side).
 * The React factory reads/writes App-class properties and delegates ~95 methods
 * back to the class; here we translate that shape into one driven by Svelte
 * $state stores, DOM refs, and method closures owned by App.svelte.
 *
 * Batch 1 scope: file exists, AppEngineContext type imported, factory returns
 * a context that THROWS on every access. App.svelte does not call any engine
 * module yet, so nothing trips the throws. Each subsequent Phase 6 batch wires
 * a slice of fields (state/canvas → pointer → keyboard → actions → …) and
 * replaces its throws with real implementations.
 *
 * React semantics carry-overs to resolve when wiring:
 * - `withBatchedUpdates` (reactUtils.ts) is `unstable_batchedUpdates(fn)`, which
 *   in React 18+ is nearly a no-op. Svelte 5 batches $state writes per
 *   microtask automatically, so the Svelte-side replacement can be identity.
 * - `setState(patch, callback)`: React runs `callback` post-commit. Svelte
 *   equivalent is `await tick()` / `queueMicrotask`. Only fileOps.ts uses the
 *   callback form (to chain `actionManager.executeAction(actionFinalize)`).
 * - `setState((prev) => ...)`: the React factory applies the updater via
 *   `app.setState`. Svelte equivalent: read current $state, call updater, write
 *   back. Order-of-writes inside a tick is sync-visible, which differs from
 *   React's pre-commit snapshot semantics. Audit each updater callsite when
 *   wiring.
 */

// @ts-ignore
// lives in packages/tsconfig.base.json but sveltedraw-app's tsconfig does
// not extend from it.
import type { AppEngineContext } from "@sveltedraw/engine/engine/AppEngineContext";

/**
 * Runtime refs owned by App.svelte and handed to the factory.
 * Kept minimal; grows per batch.
 */
export type SvelteEngineRefs = {
  /** Reactive AppState (Svelte 5 $state). Read via `getState`, written via `setState`. */
  appState: {
    // Structural: any $state proxy exposing AppState fields + a replace() helper.
    // The concrete shape is defined in App.svelte.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    current: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    patch: (patch: any) => void;
  };
  /** Container div, set by `bind:this` in App.svelte. */
  containerRef: { current: HTMLDivElement | null };
  /** Static + NewElement backing canvas (externally owned — App.svelte creates). */
  staticCanvas: HTMLCanvasElement;
  /** Interactive canvas element, set by handleCanvasRef. */
  interactiveCanvasRef: { current: HTMLCanvasElement | null };
};

/**
 * Build a (mostly stub) AppEngineContext from Svelte refs.
 * Batch 1: every access throws. Subsequent batches fill in real wiring.
 */
export function createEngineContextSvelte(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  refs: SvelteEngineRefs,
): AppEngineContext {
  const notWired = (field: string) => (): never => {
    throw new Error(
      `[Phase 6 batch 1] AppEngineContext.${field} is not yet wired on the Svelte side. ` +
        `This means an engine module was called before App.svelte supplied it — check the call stack and either wire the field or gate the call behind a batch-guard.`,
    );
  };

  // Proxy strategy: return an object that throws on every read. We do this
  // instead of listing all ~95 fields so the TypeScript check is trivially
  // satisfied (empty object cast) and runtime errors point at the exact
  // missing field.
  const stub = new Proxy(
    {},
    {
      get: (_target, prop: string) => notWired(String(prop))(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as unknown as AppEngineContext;

  return stub;
}
