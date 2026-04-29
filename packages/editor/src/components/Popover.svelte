<script lang="ts">
  // SCSS sidecar (Popover.scss) loaded globally by host app.
  //
  // This is the *legacy* Sveltedraw Popover (manually positioned div with
  // focus trap, click-outside, and viewport-fit logic) — NOT the bits-ui
  // Popover. Used by colour pickers, tool popovers, etc.

  import type { Snippet } from "svelte";
  import clsx from "clsx";
  // @ts-ignore
  import { KEYS, queryFocusableElements } from "@sveltedraw/common";

  let {
    children,
    left,
    top,
    onCloseRequest,
    fitInViewport = false,
    offsetLeft = 0,
    offsetTop = 0,
    viewportWidth,
    viewportHeight,
    class: className = "",
  }: {
    children?: Snippet;
    left?: number;
    top?: number;
    onCloseRequest?: (event: PointerEvent) => void;
    fitInViewport?: boolean;
    offsetLeft?: number;
    offsetTop?: number;
    viewportWidth?: number;
    viewportHeight?: number;
    class?: string;
  } = $props();

  let popoverRef: HTMLDivElement | null = $state(null);
  let lastInitializedPos: { top: number; left: number } | null = null;

  // Auto-focus + Tab focus-trap; runs once on mount.
  $effect(() => {
    const container = popoverRef;
    if (!container) return;

    if (!container.contains(document.activeElement)) {
      container.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== KEYS.TAB) return;
      const focusableElements = queryFocusableElements(container);
      const { activeElement } = document;
      const currentIndex = focusableElements.findIndex(
        (el: HTMLElement) => el === activeElement,
      );

      if (activeElement === container) {
        if (event.shiftKey) {
          focusableElements[focusableElements.length - 1]?.focus();
        } else {
          focusableElements[0]?.focus();
        }
        event.preventDefault();
        event.stopImmediatePropagation();
      } else if (currentIndex === 0 && event.shiftKey) {
        focusableElements[focusableElements.length - 1]?.focus();
        event.preventDefault();
        event.stopImmediatePropagation();
      } else if (
        currentIndex === focusableElements.length - 1 &&
        !event.shiftKey
      ) {
        focusableElements[0]?.focus();
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  });

  // Viewport-fit re-positioning. Re-runs when top/left/viewport size change.
  $effect(() => {
    if (!fitInViewport || !popoverRef || top == null || left == null) return;
    const container = popoverRef;
    const { width, height } = container.getBoundingClientRect();
    const vw = viewportWidth ?? window.innerWidth;
    const vh = viewportHeight ?? window.innerHeight;

    // Skip if already initialized at this exact position.
    if (
      lastInitializedPos?.top === top &&
      lastInitializedPos?.left === left
    ) {
      return;
    }
    lastInitializedPos = { top, left };

    if (width >= vw) {
      container.style.width = `${vw}px`;
      container.style.left = "0px";
      container.style.overflowX = "scroll";
    } else if (left + width - offsetLeft > vw) {
      container.style.left = `${vw - width - 10}px`;
    } else {
      container.style.left = `${left}px`;
    }

    if (height >= vh) {
      container.style.height = `${vh - 20}px`;
      container.style.top = "10px";
      container.style.overflowY = "scroll";
    } else if (top + height - offsetTop > vh) {
      container.style.top = `${vh - height}px`;
    } else {
      container.style.top = `${top}px`;
    }
  });

  // Click-outside listener — only attached when onCloseRequest is supplied.
  $effect(() => {
    if (!onCloseRequest) return;
    const handler = (event: PointerEvent) => {
      if (!popoverRef?.contains(event.target as Node)) {
        onCloseRequest(event);
      }
    };
    document.addEventListener("pointerdown", handler, false);
    return () => document.removeEventListener("pointerdown", handler, false);
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class={clsx("popover", className)}
  bind:this={popoverRef}
  tabindex="-1"
>
  {@render children?.()}
</div>
