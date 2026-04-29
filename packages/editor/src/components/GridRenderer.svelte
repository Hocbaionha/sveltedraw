<script lang="ts">
  import type { GridConfig } from '../snap/types.js';
  import { getGridLines } from '../snap/types.js';

  let { gridConfig, width, height, zoomLevel, offsetX = 0, offsetY = 0 } = $props();

  const gridLines = $derived(() => {
    if (!gridConfig.enabled || !gridConfig.visible) {
      return { vertical: [], horizontal: [] };
    }
    return getGridLines(width, height, gridConfig.size);
  });

  const scaledGridSize = $derived(gridConfig.size * zoomLevel);
</script>

{#if gridConfig.enabled && gridConfig.visible}
  <svg
    class="grid-renderer"
    style="
      width: {width}px;
      height: {height}px;
      opacity: {gridConfig.opacity};
      pointer-events: none;
      position: absolute;
      top: 0;
      left: 0;
    "
  >
    {#each gridLines().vertical as x (x)}
      <line
        x1={x * zoomLevel + offsetX}
        y1="0"
        x2={x * zoomLevel + offsetX}
        y2={height}
        class="grid-line grid-line-v"
        stroke="#ccc"
        stroke-width="1"
      />
    {/each}

    {#each gridLines().horizontal as y (y)}
      <line
        x1="0"
        y1={y * zoomLevel + offsetY}
        x2={width}
        y2={y * zoomLevel + offsetY}
        class="grid-line grid-line-h"
        stroke="#ccc"
        stroke-width="1"
      />
    {/each}

    <!-- Grid points (small dots at intersections) -->
    {#each gridLines().vertical as x (x)}
      {#each gridLines().horizontal as y (`${x}-${y}`)}
        <circle
          cx={x * zoomLevel + offsetX}
          cy={y * zoomLevel + offsetY}
          r="1.5"
          class="grid-point"
          fill="#ccc"
          opacity="0.6"
        />
      {/each}
    {/each}
  </svg>
{/if}

<style>
  .grid-renderer {
    z-index: 1;
  }

  :global(.sveltedraw.theme--dark) .grid-line {
    stroke: #444;
  }

  :global(.sveltedraw.theme--dark) .grid-point {
    fill: #555;
  }
</style>
