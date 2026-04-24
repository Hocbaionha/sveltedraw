// Mobile touch gestures: long-press → context menu, two-finger pan + pinch
// zoom. Returns a teardown that removes the listeners.

export type TouchDeps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appState: any;
  bumpSceneRepaint: () => void;
  showContextMenu: (clientX: number, clientY: number) => void;
};

export function installTouchGestures(
  containerEl: HTMLElement,
  deps: TouchDeps,
): () => void {
  const { appState, bumpSceneRepaint, showContextMenu } = deps;

  let touchStartX = 0;
  let touchStartY = 0;
  let touchCount = 0;
  let lastTouchDistance = 0;
  let longPressTimeout: number | null = null;

  const onTouchStart = (e: TouchEvent) => {
    touchCount = e.touches.length;
    if (touchCount === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      // Long-press → context menu after 500ms (only if still single-touch).
      longPressTimeout = window.setTimeout(() => {
        if (touchCount === 1) {
          showContextMenu(touchStartX, touchStartY);
        }
      }, 500);
    } else if (touchCount === 2) {
      if (longPressTimeout) clearTimeout(longPressTimeout);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (longPressTimeout && touchCount === 1) {
      // Cancel long-press once the finger moves > 10px.
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clearTimeout(longPressTimeout);
        longPressTimeout = null;
      }
    }

    if (touchCount === 2 && e.touches.length === 2) {
      // Two-finger pan: scroll opposite to finger movement.
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const dx = centerX - touchStartX;
      const dy = centerY - touchStartY;
      const zoomV = appState.zoom?.value || 1;
      appState.scrollX -= dx / zoomV;
      appState.scrollY -= dy / zoomV;
      touchStartX = centerX;
      touchStartY = centerY;

      // Pinch-zoom (clamped to [0.1, 4]).
      const dx2 = e.touches[0].clientX - e.touches[1].clientX;
      const dy2 = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (lastTouchDistance > 0) {
        const scale = distance / lastTouchDistance;
        const currentZoom = appState.zoom?.value || 1;
        const newZoom = currentZoom * scale;
        const clampedZoom = Math.max(0.1, Math.min(4, newZoom));
        appState.zoom = { value: clampedZoom };
      }
      lastTouchDistance = distance;
      bumpSceneRepaint();
    }
  };

  const onTouchEnd = () => {
    if (longPressTimeout) {
      clearTimeout(longPressTimeout);
      longPressTimeout = null;
    }
    touchCount = 0;
    lastTouchDistance = 0;
  };

  containerEl.addEventListener("touchstart", onTouchStart, { passive: true });
  containerEl.addEventListener("touchmove", onTouchMove, { passive: true });
  containerEl.addEventListener("touchend", onTouchEnd, { passive: true });

  return () => {
    containerEl.removeEventListener("touchstart", onTouchStart);
    containerEl.removeEventListener("touchmove", onTouchMove);
    containerEl.removeEventListener("touchend", onTouchEnd);
  };
}
