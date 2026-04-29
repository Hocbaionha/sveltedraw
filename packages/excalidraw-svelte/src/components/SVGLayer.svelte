<script lang="ts">
  // Port of packages/excalidraw/components/SVGLayer.tsx
  // SCSS sidecar (SVGLayer.scss) loaded globally by host app.
  //
  // `Trail` from @sveltedraw/engine/animated-trail carries a `.start(svg)`
  // and `.stop()` API. We treat the trail array as opaque here — any object
  // shape with those two methods works.

  type TrailLike = {
    start: (svg: SVGSVGElement) => void;
    stop: () => void;
  };

  let { trails }: { trails: readonly TrailLike[] } = $props();

  let svgEl: SVGSVGElement | null = $state(null);

  // The effect re-runs when the `trails` array identity changes. Upstream
  // always rebuilds the array when any element changes, so array-identity
  // tracking suffices. We iterate inside the effect so per-slot reads are
  // tracked too (covers the edge case of a parent mutating an index in place).
  $effect(() => {
    const svg = svgEl;
    if (!svg) return;
    const snapshot: TrailLike[] = [];
    for (const t of trails) snapshot.push(t); // reads + tracks each slot
    for (const trail of snapshot) trail.start(svg);
    return () => {
      for (const trail of snapshot) trail.stop();
    };
  });
</script>

<div class="SVGLayer">
  <svg bind:this={svgEl}></svg>
</div>
