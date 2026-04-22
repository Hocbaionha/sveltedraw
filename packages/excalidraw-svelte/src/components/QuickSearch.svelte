<script lang="ts">
  // Port of packages/excalidraw/components/QuickSearch.tsx
  // SCSS sidecar (QuickSearch.scss) loaded globally by host app.
  import clsx from "clsx";
  import Icon from "../icons/Icon.svelte";

  let {
    class: className = "",
    placeholder,
    onChange,
    ref = $bindable<HTMLInputElement | null>(null),
  }: {
    class?: string;
    placeholder: string;
    onChange: (term: string) => void;
    ref?: HTMLInputElement | null;
  } = $props();
</script>

<div class={clsx("QuickSearch__wrapper", className)}>
  <Icon name="searchIcon" />
  <input
    bind:this={ref}
    class="QuickSearch__input"
    type="text"
    {placeholder}
    oninput={(e) =>
      onChange((e.currentTarget as HTMLInputElement).value.trim().toLowerCase())}
  />
</div>
