/**
 * Framework-agnostic tooltip DOM utilities.
 * Ported from packages/excalidraw/components/Tooltip.tsx.
 *
 * These are used by components that need imperative tooltip positioning
 * (e.g. Hyperlink, ColorPicker) — independent of whichever Tooltip
 * implementation is used.
 */

export const getTooltipDiv = (): HTMLDivElement => {
  const existing = document.querySelector<HTMLDivElement>(".excalidraw-tooltip");
  if (existing) return existing;
  const div = document.createElement("div");
  document.body.appendChild(div);
  div.classList.add("excalidraw-tooltip");
  return div;
};

export const updateTooltipPosition = (
  tooltip: HTMLDivElement,
  item: { left: number; top: number; width: number; height: number },
  position: "bottom" | "top" = "bottom",
): void => {
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 5;

  let left = item.left + item.width / 2 - tooltipRect.width / 2;
  if (left < 0) {
    left = margin;
  } else if (left + tooltipRect.width >= viewportWidth) {
    left = viewportWidth - tooltipRect.width - margin;
  }

  let top: number;
  if (position === "bottom") {
    top = item.top + item.height + margin;
    if (top + tooltipRect.height >= viewportHeight) {
      top = item.top - tooltipRect.height - margin;
    }
  } else {
    top = item.top - tooltipRect.height - margin;
    if (top < 0) {
      top = item.top + item.height + margin;
    }
  }

  Object.assign(tooltip.style, { top: `${top}px`, left: `${left}px` });
};
