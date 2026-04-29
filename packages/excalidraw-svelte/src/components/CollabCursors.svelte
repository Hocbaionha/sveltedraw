<script lang="ts">
  // Phase 17 / Track A2 — peer cursor overlay.
  //
  // Reads collabStore from context (set by App.svelte) and renders one
  // cursor + name badge per remote peer with a non-null awareness.cursor.
  // Self is filtered by store.myUserId so the local user's own cursor
  // doesn't render twice (the OS already renders the native pointer).
  //
  // Coordinates: peers broadcast both viewport coords (x, y) and scene
  // coords (sceneX, sceneY). We render against scene coords + the
  // local appState so peers' cursors track our pan/zoom — if a peer
  // points at element X, our cursor render lands on element X regardless
  // of how either of us has scrolled.
  //
  // The container is pointer-events: none so the overlay never steals
  // hover/click from the canvas underneath.

  import { getContext } from "svelte";
  // @ts-ignore — resolved via Vite alias to packages/common/src
  import { sceneCoordsToViewportCoords } from "@sveltedraw/common";
  import {
    COLLAB_STORE_KEY,
    type CollabStore,
  } from "../collab/store.svelte.js";

  // appState slice we need for the conversion. Passed as a prop (rather
  // than read from context) because the conversion is reactive to every
  // pan/zoom and we want $derived tracking through the prop boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type ZoomLike = { value: number };
  let {
    appState,
  }: {
    appState: {
      zoom: ZoomLike;
      offsetLeft: number;
      offsetTop: number;
      scrollX: number;
      scrollY: number;
    };
  } = $props();

  const collabStore = getContext<CollabStore | undefined>(COLLAB_STORE_KEY);

  // Derived list of cursors to render. We iterate the awareness Map +
  // filter out self + filter out users with no cursor. The result is a
  // flat array of `{ key, viewport: {x, y}, name, color }` so the
  // template can render with stable keys (#each ... (key)).
  type RenderedCursor = {
    key: number;
    x: number;
    y: number;
    name: string;
    color: string;
  };

  const cursors = $derived.by((): RenderedCursor[] => {
    if (!collabStore) return [];
    if (collabStore.status !== "connected") return [];
    const myUserId = collabStore.myUserId;
    const out: RenderedCursor[] = [];
    for (const [clientId, user] of collabStore.users) {
      // Skip self. We compare on user.id (stable across reconnects)
      // rather than awareness clientID (regenerated per ws session).
      if (user.id === myUserId) continue;
      if (!user.cursor) continue;
      // The upstream conversion expects a NormalizedZoomValue brand on
      // zoom.value, but the actual computation only reads `.value`.
      // Cast at the boundary rather than threading the brand through
      // the entire collab pipeline.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { x, y } = sceneCoordsToViewportCoords(
        { sceneX: user.cursor.sceneX, sceneY: user.cursor.sceneY },
        appState as any,
      );
      out.push({
        key: clientId,
        x,
        y,
        name: user.name,
        color: user.color,
      });
    }
    return out;
  });
</script>

{#if cursors.length > 0}
  <div class="CollabCursors" aria-hidden="true">
    {#each cursors as c (c.key)}
      <div
        class="CollabCursors__item"
        style:transform={`translate(${c.x}px, ${c.y}px)`}
      >
        <!-- Pointer arrow. Drawn as inline SVG so we can fill with the
             peer's color directly. Path mirrors the canonical OS arrow
             pointer (top-left origin). -->
        <svg
          class="CollabCursors__arrow"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill={c.color}
          stroke="white"
          stroke-width="1.5"
          stroke-linejoin="round"
        >
          <path d="M5.5 3.5 L5.5 19.5 L9.5 15.5 L12 21 L14.5 20 L12 14.5 L18 14.5 Z" />
        </svg>
        <div class="CollabCursors__label" style:background={c.color}>
          {c.name}
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  /* The overlay covers the whole editor surface but never receives
     events — it's purely decorative on top of the canvas. */
  .CollabCursors {
    position: absolute;
    inset: 0;
    pointer-events: none;
    /* Above the canvas (z-index 1-10) but below modals/toolbars (50+). */
    z-index: 25;
    overflow: hidden;
  }

  /* Each cursor is positioned via `transform: translate(...)` rather
     than `left/top` so the browser can use a compositor-only paint and
     avoid layouting on every awareness tick. The will-change hint
     keeps the GPU layer warm during continuous motion. */
  .CollabCursors__item {
    position: absolute;
    top: 0;
    left: 0;
    will-change: transform;
    /* Anchor the arrow's tip at the rendered (x, y) — the SVG origin
       is the top-left of the viewBox but the visible tip is at (5, 3).
       Translating by (-2, 0) puts the tip on the rendered point. */
    margin-left: -2px;
    margin-top: 0;
  }

  .CollabCursors__arrow {
    display: block;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2));
  }

  .CollabCursors__label {
    position: absolute;
    /* Tucked against the arrow's bottom-right so the label trails the
       cursor naturally on motion. */
    top: 18px;
    left: 14px;
    padding: 2px 6px;
    border-radius: 4px;
    color: #fff;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.2;
    white-space: nowrap;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    user-select: none;
  }
</style>
