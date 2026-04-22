<script lang="ts">
  // Port of packages/excalidraw/components/FixedSideContainer.tsx
  // SCSS sidecar (FixedSideContainer.scss) loaded globally by host app.
  import type { Snippet } from "svelte";
  import clsx from "clsx";

  let {
    children,
    side,
    class: className = "",
  }: {
    children: Snippet;
    side: "top" | "left" | "right";
    class?: string;
  } = $props();
</script>

<div
  class={clsx(
    "FixedSideContainer",
    `FixedSideContainer_side_${side}`,
    className,
  )}
>
  {@render children()}
</div>
