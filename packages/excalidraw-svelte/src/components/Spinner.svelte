<script lang="ts">
  // Port of packages/excalidraw/components/Spinner.tsx
  // SCSS not imported (no build pipeline) — styles inlined below

  let {
    size = '1em',
    circleWidth = 8,
    synchronized = false,
    class: className = '',
  }: {
    size?: string | number;
    circleWidth?: number;
    synchronized?: boolean;
    class?: string;
  } = $props();

  // Captured once at mount.
  const mountTime = Date.now();
  const mountDelay = -(mountTime % 1600);
</script>

<div class={`Spinner ${className}`}>
  <svg
    viewBox="0 0 100 100"
    style:width={typeof size === 'number' ? `${size}px` : size}
    style:height={typeof size === 'number' ? `${size}px` : size}
    style:--spinner-delay={synchronized ? `${mountDelay}ms` : '0'}
  >
    <circle
      cx="50"
      cy="50"
      r={50 - circleWidth / 2}
      stroke-width={circleWidth}
      fill="none"
      stroke-miterlimit="10"
    />
  </svg>
</div>

<style>
  /*
   * Minimal Spinner styles inlined (originals in packages/excalidraw/components/Spinner.scss).
   * These are scoped to :global(.sveltedraw) by the global stylesheet;
   * here we scope to the component's own class so it works standalone.
   */
  :global(.Spinner) {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    margin-left: auto;
    margin-right: auto;
    --spinner-color: var(--icon-fill-color, currentColor);
  }

  :global(.Spinner) svg {
    animation: spinner-rotate 1.6s linear infinite;
    animation-delay: var(--spinner-delay, 0);
    transform-origin: center center;
  }

  :global(.Spinner) circle {
    stroke: var(--spinner-color);
    animation: spinner-dash 1.6s linear 0s infinite;
    stroke-linecap: round;
  }

  @keyframes spinner-rotate {
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes spinner-dash {
    0% {
      stroke-dasharray: 1, 300;
      stroke-dashoffset: 0;
    }
    50% {
      stroke-dasharray: 150, 300;
      stroke-dashoffset: -200;
    }
    100% {
      stroke-dasharray: 1, 300;
      stroke-dashoffset: -280;
    }
  }
</style>
