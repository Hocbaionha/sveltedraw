<script lang="ts">
  // SCSS sidecar (UnlockPopup.scss) loaded globally by host app.
  //
  // Positioning and action are split from each other:
  //   - Caller passes resolved viewport coords via `viewportX`/`viewportY` +
  //     `height`/`offsetTop`/`offsetLeft` (computed original with
  //     `sceneCoordsToViewportCoords(getCommonBounds(elements), appState)`).
  //   - Unlock itself is an `onUnlock` callback (caller dispatches
  //     `actionToggleElementLock` after updating selection/locked ids).

  import Icon from "../icons/Icon.svelte";

  let {
    viewportX,
    viewportY,
    height,
    offsetLeft = 0,
    offsetTop = 0,
    onUnlock,
    title = "Unlock",
  }: {
    /** Scene-to-viewport X of the element's top-left corner. */
    viewportX: number;
    /** Scene-to-viewport Y of the element's top-left corner. */
    viewportY: number;
    /** appState.height */
    height: number;
    /** appState.offsetLeft / offsetTop */
    offsetLeft?: number;
    offsetTop?: number;
    onUnlock: () => void;
    title?: string;
  } = $props();

  const bottom = $derived(`${height + 12 - viewportY + offsetTop}px`);
  const left = $derived(`${viewportX - offsetLeft}px`);
</script>

<div
  class="UnlockPopup"
  style="bottom: {bottom}; left: {left};"
  onclick={() => onUnlock()}
  role="button"
  tabindex="0"
  onkeydown={(e) => e.key === "Enter" && onUnlock()}
  {title}
>
  <Icon name="LockedIconFilled" />
</div>
