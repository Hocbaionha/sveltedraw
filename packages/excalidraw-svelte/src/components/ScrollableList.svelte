<script lang="ts">
  // Port of packages/excalidraw/components/ScrollableList.tsx
  // SCSS sidecar (ScrollableList.scss) loaded globally by host app.
  //
  // Empty content is signalled via an explicit `isEmpty` flag (Svelte can't
  // introspect snippet output to detect empty children).
  import type { Snippet } from "svelte";
  import clsx from "clsx";

  let {
    class: className = "",
    placeholder,
    isEmpty = false,
    children,
  }: {
    class?: string;
    placeholder: string;
    isEmpty?: boolean;
    children?: Snippet;
  } = $props();
</script>

<div class={clsx("ScrollableList__wrapper", className)} role="menu">
  {#if isEmpty}
    <div class="empty">{placeholder}</div>
  {:else}
    {@render children?.()}
  {/if}
</div>
