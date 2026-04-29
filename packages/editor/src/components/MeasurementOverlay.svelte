<script lang="ts">
  // A5: rulers / dimensions / distances. Pure presentational — parent
  // owns measurementConfig + selection state and pipes them in. Reading
  // `sceneNonce` in the parent's {$state} triggers re-render when
  // scene.mutateElement bumps, so dimension labels stay live during
  // resize (el.width/.height reads inside {@const} don't track otherwise).
  import type { MeasurementConfig } from "../measurements/types.js";
  import { formatMeasurement } from "../measurements/types.js";

  type Elem = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };

  let {
    config,
    selected,
    zoom,
    scrollX,
    scrollY,
    gridSize,
    width,
    height,
    sceneNonce,
  }: {
    config: MeasurementConfig;
    selected: ReadonlyArray<Elem>;
    zoom: number;
    scrollX: number;
    scrollY: number;
    gridSize: number;
    width: number;
    height: number;
    sceneNonce: number;
  } = $props();

  const RULER_SIZE = 20;

  const showRulers = $derived(config.showRulers);
  const showDims = $derived(config.showDimensions && selected.length >= 1);
  const showDists = $derived(config.showDistances && selected.length >= 2);
  const tickStep = $derived(Math.max(gridSize, 1));
</script>

{#if sceneNonce >= 0 && (showRulers || showDims || showDists)}
  <svg
    class="sveltedraw-measurement-overlay"
    {width}
    {height}
    viewBox="0 0 {width} {height}"
  >
    {#if showRulers}
      <!-- Ruler backgrounds -->
      <rect x="0" y="0" {width} height={RULER_SIZE}
            fill="rgba(255,255,255,0.92)" stroke="#d1d4da" />
      <rect x="0" y="0" width={RULER_SIZE} {height}
            fill="rgba(255,255,255,0.92)" stroke="#d1d4da" />
      <!-- Horizontal ticks -->
      {#each Array.from({ length: Math.ceil(width / (tickStep * zoom)) + 2 }) as _, i}
        {@const sceneX = Math.floor(-scrollX / tickStep) * tickStep + i * tickStep}
        {@const vx = (sceneX + scrollX) * zoom}
        {#if vx >= RULER_SIZE && vx <= width}
          <line x1={vx} y1={RULER_SIZE - 6} x2={vx} y2={RULER_SIZE}
                stroke="#888" stroke-width="1" />
          <text x={vx + 2} y={12} font-size="9" fill="#666"
                font-family="system-ui, -apple-system, sans-serif">
            {formatMeasurement(sceneX, config.unit, 0)}
          </text>
        {/if}
      {/each}
      <!-- Vertical ticks -->
      {#each Array.from({ length: Math.ceil(height / (tickStep * zoom)) + 2 }) as _, i}
        {@const sceneY = Math.floor(-scrollY / tickStep) * tickStep + i * tickStep}
        {@const vy = (sceneY + scrollY) * zoom}
        {#if vy >= RULER_SIZE && vy <= height}
          <line x1={RULER_SIZE - 6} y1={vy} x2={RULER_SIZE} y2={vy}
                stroke="#888" stroke-width="1" />
          <text x={2} y={vy + 10} font-size="9" fill="#666"
                font-family="system-ui, -apple-system, sans-serif">
            {formatMeasurement(sceneY, config.unit, 0)}
          </text>
        {/if}
      {/each}
    {/if}

    {#if showDims}
      {#each selected as el (el.id + ":" + sceneNonce)}
        <text
          class="sveltedraw-measurement-dimension"
          x={(el.x + el.width / 2 + scrollX) * zoom}
          y={(el.y + scrollY) * zoom - 8}
          text-anchor="middle" font-size="11"
          font-family="system-ui, -apple-system, sans-serif"
          fill="#6965db" font-weight="600"
        >
          {formatMeasurement(el.width, config.unit, config.precision)} × {formatMeasurement(el.height, config.unit, config.precision)}
        </text>
      {/each}
    {/if}

    {#if showDists}
      {#each selected.slice(1) as el, i (el.id + ":" + sceneNonce)}
        {@const a = selected[i]}
        {@const ax = (a.x + a.width / 2 + scrollX) * zoom}
        {@const ay = (a.y + a.height / 2 + scrollY) * zoom}
        {@const bx = (el.x + el.width / 2 + scrollX) * zoom}
        {@const by = (el.y + el.height / 2 + scrollY) * zoom}
        {@const d = Math.hypot(bx - ax, by - ay) / zoom}
        <line class="sveltedraw-measurement-distance"
              x1={ax} y1={ay} x2={bx} y2={by}
              stroke="#6965db" stroke-width="1.5"
              stroke-dasharray="4 3" />
        <text x={(ax + bx) / 2} y={(ay + by) / 2 - 6}
              text-anchor="middle" font-size="11"
              font-family="system-ui, -apple-system, sans-serif"
              fill="#6965db" font-weight="600">
          d = {formatMeasurement(d, config.unit, config.precision)}
        </text>
      {/each}
    {/if}
  </svg>
{/if}

<style>
  .sveltedraw-measurement-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 25;
  }
</style>
