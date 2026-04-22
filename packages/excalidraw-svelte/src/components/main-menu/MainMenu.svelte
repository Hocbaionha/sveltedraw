<script lang="ts">
  // Port of packages/excalidraw/components/main-menu/MainMenu.tsx (shell only).
  //
  // A DropdownMenu containing user-supplied children plus an optional
  // phone-formFactor UserList fieldset. The caller decides which
  // DefaultItems/Separators/Sub-menus to render.
  //
  // Contract:
  //  - Open state is controlled: `open` prop + `onToggle` callback.
  //  - Close-on-select: the caller's `onSelect` runs first; `onClose` is
  //    invoked unconditionally unless `event.defaultPrevented`.
  //  - The mobile UserList fieldset accepts a `userList` snippet (caller
  //    supplies it + decides visibility based on formFactor + collaborators).

  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import {
    TUNNELS_KEY,
    type TunnelsContext,
  } from "../../state/tunnels.svelte.js";
  import TunnelIn from "../TunnelIn.svelte";
  import WithInternalFallback from "../WithInternalFallback.svelte";
  import DropdownMenu from "../DropdownMenu.svelte";
  import DropdownMenuTrigger from "../DropdownMenuTrigger.svelte";
  import DropdownMenuContent from "../DropdownMenuContent.svelte";
  import Icon from "../../icons/Icon.svelte";

  let {
    open,
    onToggle,
    onClose,
    onSelect,
    children,
    userList,
    fallback = false,
    triggerTitle = "Menu",
  }: {
    open: boolean;
    /** Called by the hamburger trigger to flip the open state. */
    onToggle: () => void;
    /** Called whenever an item is selected (to close the menu). Wraps
     * upstream `setAppState({ openMenu: null })`. */
    onClose: () => void;
    /** Optional extra "on select" handler (each item still calls its own). */
    onSelect?: (event: Event) => void;
    /** DefaultItems + user-supplied items. */
    children: Snippet;
    /** Optional UserList fieldset for phone formFactor (caller decides when). */
    userList?: Snippet;
    /** Set to true when this is the editor's built-in default (host wins
     * via WithInternalFallback). */
    fallback?: boolean;
    triggerTitle?: string;
  } = $props();

  const tunnels = getContext<TunnelsContext>(TUNNELS_KEY);

  function handleItemSelect(event: Event) {
    onSelect?.(event);
    if (!event.defaultPrevented) {
      onClose();
    }
  }
</script>

<WithInternalFallback name="MainMenu" {fallback}>
  <TunnelIn tunnel={tunnels.MainMenuTunnel}>
    <DropdownMenu {open}>
      <DropdownMenuTrigger
        {onToggle}
        data-testid="main-menu-trigger"
        class="main-menu-trigger"
        title={triggerTitle}
      >
        {#snippet children()}
          <Icon name="HamburgerMenuIcon" />
        {/snippet}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        onClickOutside={onClose}
        className="main-menu"
        align="start"
      >
        {@render children()}
        {#if userList}
          {@render userList()}
        {/if}
      </DropdownMenuContent>
    </DropdownMenu>
  </TunnelIn>
</WithInternalFallback>
