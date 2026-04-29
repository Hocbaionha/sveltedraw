//
// Named tunnels act as portals: a TunnelIn registers a snippet that is
// rendered elsewhere by TunnelOut. LayerUI exposes extension points
// (MainMenu, WelcomeScreen, Footer, …) that user-supplied children fill in.
// Each Tunnel keeps a reactive list of registered snippets; counters live in
// TunnelsContext (per-Sveltedraw-instance) so multiple instances on one page
// do not interfere.

import type { Snippet } from "svelte";

let nextEntryId = 0;

export type TunnelEntry = {
  id: number;
  snippet: Snippet;
};

export class Tunnel {
  entries = $state<TunnelEntry[]>([]);

  push(snippet: Snippet): number {
    const id = ++nextEntryId;
    this.entries.push({ id, snippet });
    return id;
  }

  remove(id: number): void {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx >= 0) this.entries.splice(idx, 1);
  }
}

// Counter that backs WithInternalFallback. One instance per (TunnelsContext,
// component-name) pair — see TunnelsContext.getFallbackCounter.
export class FallbackCounter {
  count = $state(0);
  preferHost = $state(false);
}

export class TunnelsContext {
  // Named tunnels exposed to LayerUI extension points.
  MainMenuTunnel = new Tunnel();
  WelcomeScreenMenuHintTunnel = new Tunnel();
  WelcomeScreenToolbarHintTunnel = new Tunnel();
  WelcomeScreenHelpHintTunnel = new Tunnel();
  WelcomeScreenCenterTunnel = new Tunnel();
  FooterCenterTunnel = new Tunnel();
  DefaultSidebarTriggerTunnel = new Tunnel();
  DefaultSidebarTabTriggersTunnel = new Tunnel();
  OverwriteConfirmDialogTunnel = new Tunnel();
  TTDDialogTriggerTunnel = new Tunnel();

  // Per-name fallback counters used by WithInternalFallback. Each component
  // wrapped via WithInternalFallback registers under its display-name key so
  // that all instances of that name share the same counter (within this
  // editor instance).
  private fallbackCounters = new Map<string, FallbackCounter>();
  getFallbackCounter(name: string): FallbackCounter {
    let c = this.fallbackCounters.get(name);
    if (!c) {
      c = new FallbackCounter();
      this.fallbackCounters.set(name, c);
    }
    return c;
  }
}

export function createTunnelsContext(): TunnelsContext {
  return new TunnelsContext();
}

/**
 * Svelte context key for the per-editor TunnelsContext.
 *
 * Provider:
 *   import { setContext } from "svelte";
 *   import { TUNNELS_KEY, createTunnelsContext } from "$state";
 *   setContext(TUNNELS_KEY, createTunnelsContext());
 *
 * Consumer:
 *   import { getContext } from "svelte";
 *   import { TUNNELS_KEY, type TunnelsContext } from "$state";
 *   const tunnels = getContext<TunnelsContext>(TUNNELS_KEY);
 *   tunnels.MainMenuTunnel; // → Tunnel instance
 */
export const TUNNELS_KEY: unique symbol = Symbol("tunnels");
