<script lang="ts">
  // Port of packages/excalidraw/components/dropdownMenu/DropdownMenuItemLink.tsx
  import type { Snippet } from "svelte";
  import { DropdownMenu as BitsDropdownMenu } from "bits-ui";
  import DropdownMenuItemContent from "./DropdownMenuItemContent.svelte";

  let {
    icon,
    shortcut,
    href,
    children,
    onSelect,
    onParentSelect,
    class: className = "",
    selected,
    rel = "noopener",
    title,
    "aria-label": ariaLabel,
    ...rest
  }: {
    href: string;
    icon?: Snippet;
    children: Snippet;
    shortcut?: string;
    class?: string;
    selected?: boolean;
    onSelect?: (event: Event) => void;
    onParentSelect?: (event: Event) => void;
    rel?: string;
    title?: string;
    "aria-label"?: string;
    [key: string]: unknown;
  } = $props();

  function handleSelect(event: Event) {
    onSelect?.(event);
    if (!event.defaultPrevented) {
      onParentSelect?.(event);
    }
  }

  const linkClass = $derived(
    `dropdown-menu-item dropdown-menu-item-base ${className} ${
      selected ? "dropdown-menu-item--selected" : ""
    }`.trim(),
  );
</script>

<BitsDropdownMenu.Item onSelect={handleSelect}>
  {#snippet child({ props })}
    <a
      {...props}
      {...rest}
      {href}
      target="_blank"
      rel={`noopener ${rel}`}
      class={linkClass}
      title={title ?? ariaLabel}
      aria-label={ariaLabel}
    >
      <DropdownMenuItemContent {icon} {shortcut}>
        {@render children()}
      </DropdownMenuItemContent>
    </a>
  {/snippet}
</BitsDropdownMenu.Item>
