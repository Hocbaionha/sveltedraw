<script lang="ts">
  import type { Theme } from "@excalidraw/element/types";
  interface Props { theme?: Theme; }
  let { theme: _theme }: Props = $props();
</script>

<svg
  aria-hidden="true"
  focusable="false"
  role="img"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <g
    stroke-width="1.5"
    stroke="currentColor"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <line x1="4" y1="12" x2="9" y2="12" />
    <line x1="15" y1="12" x2="20" y2="12" />
    <rect x="9" y="6" width="6" height="12" rx="2" />
  </g>
</svg>
