<script lang="ts">
  // Port of packages/excalidraw/components/Sidebar/SidebarHeader.tsx
  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import clsx from "clsx";
  import type { EditorInterface } from "@sveltedraw/common";
  import Button from "../Button.svelte";
  import Tooltip from "../Tooltip.svelte";
  import Icon from "../../icons/Icon.svelte";
  import { EDITOR_INTERFACE_KEY } from "../../state/index.js";
  import {
    SIDEBAR_PROPS_KEY,
    type SidebarPropsContextValue,
  } from "./common.js";

  let {
    children,
    class: className = "",
    dockLabel = "Dock",
    closeLabel = "Close",
  }: {
    children?: Snippet;
    class?: string;
    dockLabel?: string;
    closeLabel?: string;
  } = $props();

  const editorInterface =
    getContext<EditorInterface | undefined>(EDITOR_INTERFACE_KEY);
  const sidebarProps =
    getContext<SidebarPropsContextValue>(SIDEBAR_PROPS_KEY);

  const renderDockButton = $derived(
    !!editorInterface?.canFitSidebar && sidebarProps.shouldRenderDockButton,
  );
</script>

<div class={clsx("sidebar__header", className)} data-testid="sidebar-header">
  {@render children?.()}
  <div class="sidebar__header__buttons">
    {#if renderDockButton}
      <Tooltip label={dockLabel}>
        {#snippet children()}
          <Button
            onSelect={() =>
              sidebarProps.onDock?.(!sidebarProps.docked)}
            selected={!!sidebarProps.docked}
            class="sidebar__dock"
            data-testid="sidebar-dock"
            aria-label={dockLabel}
          >
            {#snippet children()}
              <Icon name="PinIcon" />
            {/snippet}
          </Button>
        {/snippet}
      </Tooltip>
    {/if}
    <Button
      data-testid="sidebar-close"
      class="sidebar__close"
      onSelect={() => sidebarProps.onCloseRequest()}
      aria-label={closeLabel}
    >
      {#snippet children()}
        <Icon name="CloseIcon" />
      {/snippet}
    </Button>
  </div>
</div>
