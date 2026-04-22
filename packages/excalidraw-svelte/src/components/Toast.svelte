<script lang="ts">
  // Port of packages/excalidraw/components/Toast.tsx
  // ToolButton swapped for a plain <button> with inlined CloseIcon SVG.
  // ProgressBar lives in the sibling ToastProgressBar.svelte and is imported
  // separately (no dot-accessed static subcomponent).

  import type { Snippet } from 'svelte';

  const DEFAULT_TOAST_TIMEOUT = 5000;

  let {
    message,
    onClose,
    closable = false,
    duration = DEFAULT_TOAST_TIMEOUT,
    style,
  }: {
    message: string | Snippet;
    onClose: () => void;
    closable?: boolean;
    duration?: number;
    style?: string;
  } = $props();

  const shouldAutoClose = $derived(duration !== Infinity);
  let timerId: number = 0;

  function scheduleTimeout() {
    if (!shouldAutoClose) return;
    clearTimeout(timerId);
    timerId = window.setTimeout(() => onClose(), duration);
  }

  $effect(() => {
    // re-trigger on message/duration change
    void message;
    void duration;
    if (!shouldAutoClose) return;
    scheduleTimeout();
    return () => clearTimeout(timerId);
  });

  function handleMouseEnter() {
    if (shouldAutoClose) clearTimeout(timerId);
  }

  function handleMouseLeave() {
    if (shouldAutoClose) scheduleTimeout();
  }
</script>

<div
  class="Toast"
  role="status"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  {style}
>
  <div class="Toast__message">
    {#if typeof message === 'string'}
      {message}
    {:else}
      {@render message()}
    {/if}
  </div>
  {#if closable}
    <button
      type="button"
      class="ToolIcon ToolIcon_type_button ToolIcon_size_medium close"
      aria-label="close"
      onclick={onClose}
    >
      <div class="ToolIcon__icon">
        <svg
          aria-hidden="true"
          focusable="false"
          role="img"
          viewBox="0 0 20 20"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <g
            clip-path="url(#toast-close-clip)"
            stroke="currentColor"
            stroke-width="1.25"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M15 5 5 15M5 5l10 10" />
          </g>
          <defs>
            <clipPath id="toast-close-clip">
              <path fill="#fff" d="M0 0h20v20H0z" />
            </clipPath>
          </defs>
        </svg>
      </div>
    </button>
  {/if}
</div>
