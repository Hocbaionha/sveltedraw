<script lang="ts">
  // Port of WelcomeScreenMenuItem from welcome-screen/WelcomeScreen.Center.tsx
  import type { Snippet } from "svelte";
  import MenuItemContent from "./MenuItemContent.svelte";

  let {
    onSelect,
    children,
    icon,
    shortcut,
    class: className = "",
    ...rest
  }: {
    onSelect: () => void;
    children: Snippet;
    icon?: Snippet;
    shortcut?: string | null;
    class?: string;
    [key: string]: unknown;
  } = $props();
</script>

<button
  {...rest}
  type="button"
  class={`welcome-screen-menu-item ${className}`}
  onclick={onSelect}
>
  <MenuItemContent {icon} {shortcut}>
    {@render children()}
  </MenuItemContent>
</button>
