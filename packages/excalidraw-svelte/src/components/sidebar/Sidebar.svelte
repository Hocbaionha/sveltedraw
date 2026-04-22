<script lang="ts">
  // Port of packages/excalidraw/components/Sidebar/Sidebar.tsx
  // SCSS sidecar (Sidebar.scss) loaded globally by host app.
  //
  // Contract:
  //  - The caller decides whether to render this Sidebar (typically via
  //    `{#if openSidebar?.name === "mySidebar"}`) — no internal mount/
  //    shouldRender dance, keeping the component presentational.
  //  - `docked` is taken as a prop and published through SIDEBAR_PROPS_KEY
  //    for SidebarHeader; the caller owns any docked-state store.
  //  - editorInterface via EDITOR_INTERFACE_KEY.

  import type { Snippet } from "svelte";
  import { getContext, setContext, onDestroy } from "svelte";
  import clsx from "clsx";
  // @ts-ignore upstream package
  import { CLASSES, EVENT, KEYS } from "@excalidraw/common";
  import type { EditorInterface } from "@excalidraw/common";
  import Island from "../Island.svelte";
  import { EDITOR_INTERFACE_KEY } from "../../state/index.js";
  import {
    SIDEBAR_PROPS_KEY,
    type SidebarPropsContextValue,
  } from "./common.js";

  let {
    name,
    children,
    onDock,
    onCloseRequest,
    docked,
    class: className,
  }: {
    name: string;
    children: Snippet;
    onDock?: (docked: boolean) => void;
    /** Called when the sidebar asks to close (outside click, ESC, close button).
     * Phase 6 wires this to `setAppState({ openSidebar: null })`. */
    onCloseRequest: () => void;
    docked?: boolean;
    class?: string;
  } = $props();

  const editorInterface =
    getContext<EditorInterface | undefined>(EDITOR_INTERFACE_KEY);

  let islandRef: HTMLDivElement | undefined = $state();

  // SidebarPropsContext equivalent — SidebarHeader reads from this.
  // svelte-ignore state_referenced_locally state_referenced_locally state_referenced_locally state_referenced_locally state_referenced_locally
  const ctx: SidebarPropsContextValue = $state({
    docked,
    onDock,
    onCloseRequest,
    shouldRenderDockButton: !!onDock && docked != null,
  });
  $effect(() => {
    ctx.docked = docked;
    ctx.onDock = onDock;
    ctx.onCloseRequest = onCloseRequest;
    ctx.shouldRenderDockButton = !!onDock && docked != null;
  });
  setContext(SIDEBAR_PROPS_KEY, ctx);

  function closeIfNoDialogOpen() {
    // Skip when any Dialog is open — prevents closing the sidebar when
    // the user clicks inside a modal that happens to cover it.
    if (document.querySelector(".Dialog")) return;
    onCloseRequest();
  }

  // Outside-click close (docked sidebars don't auto-close).
  $effect(() => {
    if (!islandRef) return;
    const handler = (event: MouseEvent) => {
      if (!islandRef) return;
      if (islandRef.contains(event.target as Node)) return;
      // Library trigger toggles itself; don't immediately re-close.
      if ((event.target as Element)?.closest?.(".sidebar-trigger")) return;
      if (!docked || !editorInterface?.canFitSidebar) {
        closeIfNoDialogOpen();
      }
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  });

  // ESC close.
  $effect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.key === KEYS.ESCAPE &&
        (!docked || !editorInterface?.canFitSidebar)
      ) {
        closeIfNoDialogOpen();
      }
    };
    document.addEventListener(EVENT.KEYDOWN, handler);
    return () => document.removeEventListener(EVENT.KEYDOWN, handler);
  });
</script>

<Island
  class={clsx(CLASSES.SIDEBAR, { "sidebar--docked": docked }, className)}
  bind:ref={islandRef}
>
  {@render children()}
</Island>
