// Built-in plugin: localStorage persistence.
//
// Wraps state/persistence.ts (createPersistence) and exposes its
// scheduleSave / flushPendingSave through a published store so other
// editor code can reach it without an inline import. Lifecycle:
//
//   - install: build the persistence handle bound to the editor api;
//     publish via PERSISTENCE_STORE_KEY; observe scene changes →
//     debounced save.
//   - onEditorReady: subscribe to window 'beforeunload' for sync flush
//     so a tab close doesn't lose the trailing-edge debounce.
//   - teardown: flush any pending save + dispose the change listener.
//
// What stays in App.svelte: the one-time `tryLoad()` call from onMount.
// The plugin install runs in a $effect AFTER onMount, so moving load
// here would mean the first paint shows an empty scene, then re-paints
// with restored content — visible flash. Bootstrap stays in onMount;
// ongoing save is owned by this plugin.

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import { createPersistence, type PersistenceApi } from "../../../state/persistence.js";

export const PERSISTENCE_STORE_KEY: unique symbol = Symbol("persistenceStore");

/**
 * Scene-access bridge the host publishes via registerCtx so the
 * persistence plugin can save the full element list (including
 * soft-deleted entries — undo history needs them) without depending
 * on the SveltedrawAPI surface, which is element-centric and only
 * exposes non-deleted elements.
 *
 * App.svelte registers `{ getScene: () => scene }` under this key.
 * The plugin reads it via ctx.getStore at install time.
 */
export const PERSISTENCE_SCENE_BRIDGE_KEY: unique symbol = Symbol("persistenceSceneBridge");

export type PersistenceSceneBridge = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getScene: () => any | null;
};

export type PersistenceStore = {
  /** Schedule a debounced localStorage save. Coalesces rapid bursts. */
  requestSave: () => void;
  /** Cancel the pending debounce + write synchronously. */
  flush: () => void;
};

export const persistencePlugin: SveltedrawPlugin = {
  id: "builtin/persistence",
  install(ctx: SveltedrawPluginContext): () => void {
    // The persistence helper needs the raw Scene object (its
    // getElementsIncludingDeleted gives the full list — undo history
    // needs the soft-deleted entries). The host publishes a thin
    // bridge under PERSISTENCE_SCENE_BRIDGE_KEY in registerCtx.
    // appState comes through the api's getAppState (returns the
    // live $state proxy).
    const sceneBridge = ctx.getStore<PersistenceSceneBridge>(PERSISTENCE_SCENE_BRIDGE_KEY);
    if (!sceneBridge) {
      throw new Error(
        `[plugin:builtin/persistence] PERSISTENCE_SCENE_BRIDGE_KEY not in context — host must publish via registerCtx before plugin install`,
      );
    }
    const persistence: PersistenceApi = createPersistence({
      getScene: sceneBridge.getScene,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      appState: ctx.api.getAppState() as any,
    });

    const store: PersistenceStore = {
      requestSave: persistence.scheduleSave,
      flush: persistence.flushPendingSave,
    };
    const releaseStore = ctx.provideStore(PERSISTENCE_STORE_KEY, store);

    // Scene mutations → schedule save. The host's existing scattered
    // scheduleSave() calls are kept for appState-only changes (zoom,
    // theme, background) that don't fire api.onChange — those route
    // through the published store.
    const removeChangeObs = ctx.onSceneChange(() => {
      persistence.scheduleSave();
    });

    // beforeunload → flush pending save. Without this, the trailing-
    // edge debounce can lose the last 500ms of edits when the user
    // closes the tab. onWindowEvent attaches lazily; the underlying
    // window listener detaches when this dispose runs (last
    // observer leaves).
    let removeBeforeUnload: (() => void) | null = null;
    ctx.onEditorReady(() => {
      removeBeforeUnload = ctx.onWindowEvent("beforeunload", () => {
        persistence.flushPendingSave();
      });
      // Teardown: flush + detach beforeunload before plugin uninstall.
      return () => {
        persistence.flushPendingSave();
        removeBeforeUnload?.();
      };
    });

    return () => {
      // Plugin-level cleanup runs AFTER the onEditorReady teardown
      // (registry orders them so), so pendingSave is normally
      // already flushed. Belt-and-suspenders: call flush again here
      // in case the plugin is uninstalled before onEditorReady fires
      // (rare but possible — installer throws → registry rescues
      // disposers but the editor-ready callback was never queued).
      // Then dispose() to cancel any timer + block further saves
      // (defends against an in-flight scheduleSave from a hook that
      // ran between our flush and the timer's cancel call — the
      // disposed flag flips synchronously so the timer's saveNow
      // becomes a no-op when it fires).
      removeChangeObs();
      persistence.flushPendingSave();
      persistence.dispose();
      releaseStore();
    };
  },
};
