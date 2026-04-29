<script lang="ts">
  // `theme` prop preserved for API parity; currently unused because
  // iconFillColor() collapses to a CSS variable for both light and dark.
  import type { Theme } from "@sveltedraw/element/types";
  interface Props { theme?: Theme; }
  let { theme: _theme }: Props = $props();
</script>

<svg
  aria-hidden="true"
  focusable="false"
  role="img"
  viewBox="0 0 40 20"
>
  <path
    d="M6 10H34"
    stroke="var(--icon-fill-color)"
    stroke-width="2"
    fill="none"
    stroke-linecap="round"
  />
</svg>
