<script lang="ts">
  // Port of packages/excalidraw/components/Modal.tsx
  // Uses bits-ui Portal to render outside the component tree.
  // `theme` + `formFactor` are plain props (move to store-derived values once
  // the App-context bridge lands).

  import type { Snippet } from 'svelte';
  // @ts-ignore upstream package
  import { KEYS } from '@sveltedraw/common';
  import { Portal } from 'bits-ui';
  import clsx from 'clsx';

  type Theme = 'light' | 'dark';

  let {
    children,
    className,
    maxWidth,
    onCloseRequest,
    labelledBy,
    theme = 'light',
    formFactor = 'desktop',
    closeOnClickOutside = true,
  }: {
    children?: Snippet;
    className?: string;
    maxWidth?: number;
    onCloseRequest: () => void;
    labelledBy: string;
    theme?: Theme;
    formFactor?: 'desktop' | 'phone' | 'tablet';
    closeOnClickOutside?: boolean;
  } = $props();

  const animationsDisabled =
    typeof document !== 'undefined' &&
    document.body.classList.contains('excalidraw-animations-disabled');

  const containerClass = $derived(
    clsx('excalidraw', 'excalidraw-modal-container', {
      'excalidraw--mobile': formFactor === 'phone',
      'theme--dark': theme === 'dark',
    }),
  );

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === KEYS.ESCAPE) {
      event.stopImmediatePropagation();
      event.stopPropagation();
      onCloseRequest();
    }
  }

  function handleBackgroundClick() {
    if (closeOnClickOutside) {
      onCloseRequest();
    }
  }

  // Auto-focus the modal on mount so keydown (incl. ESC) reaches us even
  // when the caller didn't focus anything inside. Also listen at the document
  // level as a safety net if focus escapes.
  let modalEl: HTMLDivElement | null = $state(null);
  $effect(() => {
    if (modalEl && !modalEl.contains(document.activeElement)) {
      modalEl.focus();
    }
    const onDocKeyDown = (event: KeyboardEvent) => {
      if (event.key === KEYS.ESCAPE) {
        event.stopPropagation();
        onCloseRequest();
      }
    };
    document.addEventListener("keydown", onDocKeyDown);
    return () => document.removeEventListener("keydown", onDocKeyDown);
  });
</script>

<Portal to="body">
  <div class={containerClass}>
    <div
      bind:this={modalEl}
      class={clsx('Modal', className, { 'animations-disabled': animationsDisabled })}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onkeydown={handleKeydown}
      tabindex="-1"
    >
      <div
        class="Modal__background"
        onclick={handleBackgroundClick}
        role="presentation"
      ></div>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="Modal__content"
        style:--max-width={maxWidth ? `${maxWidth}px` : undefined}
        tabindex="0"
      >
        {@render children?.()}
      </div>
    </div>
  </div>
</Portal>
