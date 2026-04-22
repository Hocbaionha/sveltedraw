<script lang="ts">
  // Port of WelcomeScreenMenuItemLink from welcome-screen/WelcomeScreen.Center.tsx
  import type { Snippet } from "svelte";
  import MenuItemContent from "./MenuItemContent.svelte";

  let {
    children,
    href,
    icon,
    shortcut,
    class: className = "",
    ...rest
  }: {
    children: Snippet;
    href: string;
    icon?: Snippet;
    shortcut?: string | null;
    class?: string;
    [key: string]: unknown;
  } = $props();
</script>

<a
  {...rest}
  class={`welcome-screen-menu-item ${className}`}
  {href}
  target="_blank"
  rel="noopener"
>
  <MenuItemContent {icon} {shortcut}>
    {@render children()}
  </MenuItemContent>
</a>
