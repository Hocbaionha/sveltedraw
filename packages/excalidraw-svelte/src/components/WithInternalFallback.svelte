<script lang="ts">
  // Port of packages/excalidraw/components/hoc/withInternalFallback.tsx
  //
  // Excalidraw lets the user pass e.g. <MainMenu> as a child to override the
  // built-in default MainMenu. Both the user's host and the default fallback
  // render into the same tunnel slot — this wrapper ensures only one wins,
  // with the host taking precedence.
  //
  // Pattern: every instance increments a shared counter on mount and
  // decrements on unmount; non-fallback instances flip preferHost=true.
  // A `fallback` instance suppresses itself when (counter > 1) or
  // (counter === 0 && preferHost).

  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import {
    TUNNELS_KEY,
    type TunnelsContext,
  } from "../state/tunnels.svelte.js";

  let {
    name,
    fallback = false,
    children,
  }: {
    name: string;
    fallback?: boolean;
    children: Snippet;
  } = $props();

  const tunnels = getContext<TunnelsContext>(TUNNELS_KEY);
  const counter = $derived(tunnels.getFallbackCounter(name));

  // Mount/unmount counter. If `name` changes, the cleanup decrements the
  // old counter and the next run increments the new one.
  $effect(() => {
    const c = counter;
    c.count += 1;
    return () => {
      c.count -= 1;
      if (c.count === 0) {
        c.preferHost = false;
      }
    };
  });

  // Track whether this render is host (non-fallback). Done in a separate
  // effect so the unmount cleanup above does not also flip preferHost.
  $effect(() => {
    if (!fallback) {
      counter.preferHost = true;
    }
  });

  const shouldHide = $derived(
    fallback &&
      ((counter.count === 0 && counter.preferHost) || counter.count > 1),
  );
</script>

{#if !shouldHide}
  {@render children()}
{/if}
