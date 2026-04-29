<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    children,
    class: className = "",
    selected,
    ...rest
  }: {
    children: Snippet;
    class?: string;
    selected?: boolean;
    [key: string]: unknown;
  } = $props();

  const cssClass = $derived(
    `dropdown-menu-item-base dropdown-menu-item-custom ${className} ${
      selected ? "dropdown-menu-item--selected" : ""
    }`.trim(),
  );
</script>

<div {...rest} class={cssClass}>
  {@render children()}
</div>
