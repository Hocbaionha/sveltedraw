<script lang="ts">
  import type { SnapGuide } from '../snap/guides.js';

  let { guides = [], width = 0, height = 0, zoomLevel = 1, offsetX = 0, offsetY = 0 } = $props();
</script>

{#if guides && guides.length > 0}
  <svg
    class="snap-guide-renderer"
    style="
      width: {width}px;
      height: {height}px;
      pointer-events: none;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 5;
    "
  >
    {#each guides as guide (guide.type + guide.position)}
      {#if guide.type === 'vertical'}
        <line
          x1={guide.position * zoomLevel + offsetX}
          y1="0"
          x2={guide.position * zoomLevel + offsetX}
          y2={height}
          class="snap-guide snap-guide-v"
          stroke={guide.color || '#1890ff'}
          stroke-width="2"
          stroke-dasharray="5,5"
        />
      {:else}
        <line
          x1="0"
          y1={guide.position * zoomLevel + offsetY}
          x2={width}
          y2={guide.position * zoomLevel + offsetY}
          class="snap-guide snap-guide-h"
          stroke={guide.color || '#1890ff'}
          stroke-width="2"
          stroke-dasharray="5,5"
        />
      {/if}
    {/each}
  </svg>
{/if}

<style>
  .snap-guide-renderer {
    z-index: 5;
  }

  .snap-guide {
    animation: guide-pulse 0.3s ease-in-out;
  }

  @keyframes guide-pulse {
    0% {
      opacity: 0;
      stroke-width: 1;
    }
    50% {
      opacity: 1;
      stroke-width: 2;
    }
    100% {
      opacity: 0.7;
      stroke-width: 2;
    }
  }

  :global(.excalidraw.theme--dark) .snap-guide {
    stroke: #177ddc;
  }
</style>
