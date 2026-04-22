<script lang="ts">
  // Port of packages/excalidraw/components/dropdownMenu/DropdownMenuSubTrigger.tsx
  import type { Snippet } from "svelte";
  import { DropdownMenu as BitsDropdownMenu } from "bits-ui";
  import DropdownMenuItemContent from "./DropdownMenuItemContent.svelte";
  import Icon from "../icons/Icon.svelte";

  let {
    children,
    icon,
    shortcut,
    class: className = "",
  }: {
    children: Snippet;
    icon?: Snippet;
    shortcut?: string;
    class?: string;
  } = $props();

  const triggerClass = $derived(
    `dropdown-menu-item dropdown-menu-item-base ${className} dropdown-menu__submenu-trigger`.trim(),
  );
</script>

<BitsDropdownMenu.SubTrigger>
  {#snippet child({ props })}
    <div {...props} class={triggerClass}>
      <DropdownMenuItemContent {icon} {shortcut}>
        {@render children()}
      </DropdownMenuItemContent>
      <div class="dropdown-menu__submenu-trigger-icon">
        <Icon name="chevronRight" />
      </div>
    </div>
  {/snippet}
</BitsDropdownMenu.SubTrigger>
