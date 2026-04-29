<script lang="ts">
  //
  // Layout shell — the content that depends on ActionManager (ExitViewModeButton,
  // MobileShapeActions, MobileToolBar) is passed in as snippet props. Phase 6
  // wires them from the actual ActionManager.

  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import {
    TUNNELS_KEY,
    type TunnelsContext,
  } from "../state/tunnels.svelte.js";
  import TunnelOut from "./TunnelOut.svelte";
  import FixedSideContainer from "./FixedSideContainer.svelte";
  import Island from "./Island.svelte";
  import PenModeButton from "./PenModeButton.svelte";

  // A pared-down shape for the bits of appState this component reads.
  type UIAppStateLike = {
    openDialog: { name: string } | null;
    viewModeEnabled: boolean;
    openMenu: string | null;
    openSidebar: unknown;
    penMode: boolean;
    penDetected: boolean;
    scrolledOutside: boolean;
  };

  let {
    appState,
    onPenModeToggle,
    renderTopLeftUI,
    renderTopRightUI,
    exitViewModeButton,
    mobileShapeActions,
    mobileToolBar,
    sidebars,
    onScrollBackToContent,
    renderWelcomeScreen = false,
    penModeTitle = "Pen mode",
    scrollBackLabel = "Scroll back to content",
    scrollbarSpacing = 12,
  }: {
    appState: UIAppStateLike;
    onPenModeToggle: (value: boolean | null) => void;
    /** Host-supplied top-left UI (e.g., extra brand marks). */
    renderTopLeftUI?: Snippet;
    /** Host-supplied top-right UI (e.g., collab trigger). */
    renderTopRightUI?: Snippet;
    /** ExitViewModeButton rendered when viewModeEnabled. Phase 6 wires
     * actionManager.renderAction(...). */
    exitViewModeButton?: Snippet;
    /** Actions bar above the toolbar (MobileShapeActions in original). */
    mobileShapeActions?: Snippet;
    /** The main bottom toolbar. */
    mobileToolBar?: Snippet;
    /** Rendered sidebars (typically <DefaultSidebar /> + host sidebars). */
    sidebars?: Snippet;
    /** Called when "scroll back to content" is clicked. */
    onScrollBackToContent: () => void;
    renderWelcomeScreen?: boolean;
    penModeTitle?: string;
    scrollBackLabel?: string;
    /** Matches original SCROLLBAR_WIDTH + SCROLLBAR_MARGIN (12px). */
    scrollbarSpacing?: number;
  } = $props();

  const tunnels = getContext<TunnelsContext>(TUNNELS_KEY);

  const isElementLinkDialog = $derived(
    appState.openDialog?.name === "elementLinkSelector",
  );
</script>

{@render sidebars?.()}

<!-- welcome screen -->
<div class="App-welcome-screen">
  {#if renderWelcomeScreen}
    <TunnelOut tunnel={tunnels.WelcomeScreenCenterTunnel} />
  {/if}
</div>

<!-- bottom bar (hidden in view mode) -->
{#if !appState.viewModeEnabled}
  <div
    class="App-bottom-bar"
    style:margin-bottom={`${scrollbarSpacing}px`}
  >
    {@render mobileShapeActions?.()}

    <Island class="App-toolbar">
      {#if !appState.viewModeEnabled && !isElementLinkDialog}
        {@render mobileToolBar?.()}
      {/if}
      {#if appState.scrolledOutside && !appState.openMenu && !appState.openSidebar}
        <button
          type="button"
          class="scroll-back-to-content"
          onclick={onScrollBackToContent}
        >
          {scrollBackLabel}
        </button>
      {/if}
    </Island>
  </div>
{/if}

<!-- top bar -->
<FixedSideContainer side="top" class="App-top-bar">
  {#if !isElementLinkDialog}
    <div
      class="App-toolbar-content"
      style="display: flex; flex-direction: row; justify-content: space-between;"
    >
      <div class="sveltedraw-ui-top-left">
        {@render renderTopLeftUI?.()}
        <TunnelOut tunnel={tunnels.MainMenuTunnel} />
      </div>

      <div class="sveltedraw-ui-top-right">
        {#if renderTopRightUI}
          {@render renderTopRightUI()}
        {:else if !appState.viewModeEnabled}
          <PenModeButton
            checked={appState.penMode}
            onChange={() => onPenModeToggle(null)}
            title={penModeTitle}
            isMobile
            penDetected={appState.penDetected}
          />
          <TunnelOut tunnel={tunnels.DefaultSidebarTriggerTunnel} />
        {/if}
        {#if appState.viewModeEnabled}
          {@render exitViewModeButton?.()}
        {/if}
      </div>
    </div>
  {/if}
</FixedSideContainer>
