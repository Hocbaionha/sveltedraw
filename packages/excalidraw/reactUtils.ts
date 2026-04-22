// Post-Phase-9: React removed. This file used to wrap React state
// updates with `unstable_batchedUpdates` + expose a render-throttle
// gate keyed on React 18+. Both are no-ops here — the Svelte editor
// has its own reactivity pipeline.
//
// Left as identity/no-op stubs so any .ts file in packages/excalidraw
// that still imports from this module (e.g. `renderer/animation.ts`
// → `isRenderThrottlingEnabled`) can resolve without pulling react/
// react-dom back in. Those .ts files may still be under packages/
// excalidraw/ but unused at runtime by the Svelte app.

import { throttleRAF } from "@excalidraw/common";

/** No-op wrapper. Identity: returns the function unchanged. */
export const withBatchedUpdates = <
  TFunction extends ((event: any) => void) | (() => void),
>(
  func: Parameters<TFunction>["length"] extends 0 | 1 ? TFunction : never,
): TFunction => func as TFunction;

/** Throttle to one call per animation frame. No React batching. */
export const withBatchedUpdatesThrottled = <
  TFunction extends ((event: any) => void) | (() => void),
>(
  func: Parameters<TFunction>["length"] extends 0 | 1 ? TFunction : never,
) => {
  // @ts-ignore
  return throttleRAF<Parameters<TFunction>>(func as TFunction);
};

/**
 * Whether render throttling is enabled. The Svelte port delegates
 * throttling to the AnimationController's rAF loop, so this can be
 * off unless the dev explicitly opts in via window.EXCALIDRAW_THROTTLE_RENDER.
 */
export const isRenderThrottlingEnabled = () => {
  return (window as any).EXCALIDRAW_THROTTLE_RENDER === true;
};
