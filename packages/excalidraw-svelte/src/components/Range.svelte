<script lang="ts">
  // Port of packages/excalidraw/components/Range.tsx
  // React useRef + useEffect → bind:this + $effect (runs after DOM flush, same semantics)

  import type { Snippet } from 'svelte';

  let {
    label,
    value,
    onChange,
    min = 0,
    max = 100,
    step = 10,
    minLabel,
    hasCommonValue = true,
    testId,
  }: {
    label: Snippet | string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    minLabel?: Snippet | string | number;
    hasCommonValue?: boolean;
    testId?: string;
  } = $props();

  let rangeEl: HTMLInputElement;
  let valueEl: HTMLDivElement;

  $effect(() => {
    if (rangeEl && valueEl) {
      const inputWidth = rangeEl.offsetWidth;
      const thumbWidth =
        parseFloat(
          getComputedStyle(rangeEl).getPropertyValue('--slider-thumb-size'),
        ) || 16;
      const progress = ((value - min) / (max - min || 1)) * 100;
      const position =
        (progress / 100) * (inputWidth - thumbWidth) + thumbWidth / 2;
      valueEl.style.left = `${position}px`;
      rangeEl.style.background = `linear-gradient(to right, var(--color-slider-track) 0%, var(--color-slider-track) ${progress}%, var(--button-bg) ${progress}%, var(--button-bg) 100%)`;
    }
  });

  const resolvedMinLabel = $derived(minLabel !== undefined ? minLabel : min);
</script>

<label class="control-label">
  {#if typeof label === 'function'}
    {@render label()}
  {:else}
    {label}
  {/if}
  <div class="range-wrapper">
    <input
      style:--color-slider-track={hasCommonValue ? undefined : 'var(--button-bg)'}
      bind:this={rangeEl}
      type="range"
      {min}
      {max}
      {step}
      oninput={(event) => onChange(+(event.target as HTMLInputElement).value)}
      {value}
      class="range-input"
      data-testid={testId}
    />
    <div class="value-bubble" bind:this={valueEl}>
      {value !== min ? value : null}
    </div>
    <div class="zero-label">
      {#if typeof resolvedMinLabel === 'function'}
        {@render resolvedMinLabel()}
      {:else}
        {resolvedMinLabel}
      {/if}
    </div>
  </div>
</label>
