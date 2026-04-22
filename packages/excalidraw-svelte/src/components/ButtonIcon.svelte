<script lang="ts">
  // Port of packages/excalidraw/components/ButtonIcon.tsx
  // SCSS sidecar (ButtonIcon.scss) loaded globally by host app.

  import type { Snippet } from "svelte";
  import clsx from "clsx";

  let {
    icon,
    title,
    class: className = "",
    testId,
    active,
    standalone,
    onclick,
    style,
    ref = $bindable<HTMLButtonElement | null>(null),
  }: {
    icon: Snippet;
    title: string;
    class?: string;
    testId?: string;
    active?: boolean;
    standalone?: boolean;
    onclick: (event: MouseEvent) => void;
    style?: string;
    ref?: HTMLButtonElement | null;
  } = $props();
</script>

<button
  type="button"
  bind:this={ref}
  {title}
  data-testid={testId}
  class={clsx(className, { standalone, active })}
  {onclick}
  {style}
>
  {@render icon()}
</button>
