<script lang="ts">
  // A2: laser pointer trail overlay. Pure presentational — parent owns
  // the pointermove hook + RAF prune loop and passes the live trail in.
  // `frame` is the RAF-tick nonce; reading it in the parent's prop bind
  // keeps this component re-evaluating opacity every frame without
  // having to duplicate the RAF loop here.
  type Point = { x: number; y: number; t: number };

  let {
    active,
    trail,
    frame,
    fadeMs,
    width,
    height,
  }: {
    active: boolean;
    trail: ReadonlyArray<Point>;
    frame: number;
    fadeMs: number;
    width: number;
    height: number;
  } = $props();

  // Touch `frame` so Svelte tracks the RAF-driven nonce and re-runs the
  // opacity math every tick — otherwise a stationary pointer leaves the
  // trail at stale opacity until the next sample lands.
  const tick = $derived(frame);
</script>

{#if active || trail.length > 0}
  <svg
    class="sveltedraw-laser-overlay"
    data-laser-frame={tick}
    {width}
    {height}
    viewBox="0 0 {width} {height}"
  >
    {#each trail as p, i (p.t)}
      {#if i > 0}
        {@const prev = trail[i - 1]}
        {@const age = performance.now() - p.t}
        {@const opacity = Math.max(0, 1 - age / fadeMs)}
        <line
          x1={prev.x} y1={prev.y} x2={p.x} y2={p.y}
          stroke="#ff3b30"
          stroke-width="4"
          stroke-linecap="round"
          stroke-opacity={opacity}
        />
      {/if}
    {/each}
  </svg>
{/if}

<style>
  .sveltedraw-laser-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 30;
  }
</style>
