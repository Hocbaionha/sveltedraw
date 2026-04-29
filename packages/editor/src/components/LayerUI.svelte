<script lang="ts" module>
  // SCSS sidecars (LayerUI.scss + Toolbar.scss) loaded globally by host app.
  //
  // LayerUI is the root UI layer above the canvases. It owns layout and
  // conditional branching, and exposes each dynamic piece as a named snippet
  // prop so callers can plug in concrete components.
  //
  // Snippet slots: canvasActions, selectedShapeActions, topLeftUI, topRightUI,
  // topRightExtras, sidebars, defaultDialogs, customDialogs, bottomToolbar.

  import type { Snippet } from "svelte";

  /**
   * Minimal shape for the UI-relevant appState props LayerUI reads.
   * Phase 6 passes the full AppState (structural subset is fine).
   */
  export type LayerUIAppStateLike = {
    viewModeEnabled: boolean;
    zenModeEnabled: boolean;
    isLoading: boolean;
    errorMessage: string | null;
    openDialog: { name: string } | null;
    openSidebar: { name: string } | null;
    scrolledOutside: boolean;
    toast: {
      message: string;
      duration?: number;
      closable?: boolean;
    } | null;
    collaborators: { size: number };
  };

  export type LayerUISpacing = {
    menuTopGap: number;
    toolbarColGap: number;
    toolbarRowGap: number;
    toolbarInnerRowGap: number;
    islandPadding: number;
    collabMarginLeft: number;
  };

  export const LAYER_UI_SPACING_DEFAULT: LayerUISpacing = {
    menuTopGap: 6,
    toolbarColGap: 4,
    toolbarRowGap: 1,
    toolbarInnerRowGap: 1,
    islandPadding: 1,
    collabMarginLeft: 8,
  };

  export const LAYER_UI_SPACING_COMPACT: LayerUISpacing = {
    menuTopGap: 4,
    toolbarColGap: 4,
    toolbarRowGap: 1,
    toolbarInnerRowGap: 0.5,
    islandPadding: 1,
    collabMarginLeft: 8,
  };
</script>

<script
  lang="ts"
  generics="AppState extends LayerUIAppStateLike"
>
  import { getContext, setContext } from "svelte";
  import clsx from "clsx";
  // @ts-ignore
  import { DEFAULT_SIDEBAR } from "@sveltedraw/common";
  import type { EditorInterface } from "@sveltedraw/common";
  import {
    TUNNELS_KEY,
    createTunnelsContext,
    type TunnelsContext,
  } from "../state/tunnels.svelte.js";
  import { EDITOR_INTERFACE_KEY } from "../state/index.js";
  import FixedSideContainer from "./FixedSideContainer.svelte";
  import Section from "./Section.svelte";
  import StackCol from "./StackCol.svelte";
  import Toast from "./Toast.svelte";
  import LoadingMessage from "./LoadingMessage.svelte";
  import TunnelOut from "./TunnelOut.svelte";

  let {
    appState,
    stylesPanelMode = "full",
    isCollaborating = false,
    renderWelcomeScreen = false,
    isSidebarDocked = false,
    onScrollBackToContent,
    onToastClose,

    // ─── Host children (typically user-supplied component overrides) ───
    children,

    // ─── Default fallback renders (Phase 6 wires) ──────────────────────
    defaultMainMenu,
    defaultSidebarTrigger,
    defaultOverwriteConfirmDialog,
    defaultTTDDialog,

    // ─── Dialogs (conditionally rendered by AppState) ──────────────────
    errorDialog,
    helpDialog,
    elementLinkDialog,
    imageExportDialog,
    jsonExportDialog,
    pasteChartDialog,
    activeConfirmDialog,

    // ─── Eye-dropper overlay (appState.eyeDropperState controls mount) ─
    eyeDropper,

    // ─── Top bar (desktop layout) ──────────────────────────────────────
    selectedShapeActions,
    shapesToolbar,
    userList,
    topRightUI,
    stats,

    // ─── Sidebars ──────────────────────────────────────────────────────
    sidebars,

    // ─── Footer ────────────────────────────────────────────────────────
    footer,

    // ─── Mobile layout (full replacement for the desktop chrome) ───────
    mobileMenu,
  }: {
    appState: AppState;
    stylesPanelMode?: "full" | "compact" | "mobile";
    isCollaborating?: boolean;
    renderWelcomeScreen?: boolean;
    isSidebarDocked?: boolean;
    /** Called by the "scroll back to content" button. */
    onScrollBackToContent: () => void;
    /** Called when the toast auto-dismisses or the user closes it. */
    onToastClose: () => void;

    children?: Snippet;

    defaultMainMenu?: Snippet;
    defaultSidebarTrigger?: Snippet;
    defaultOverwriteConfirmDialog?: Snippet;
    defaultTTDDialog?: Snippet;

    errorDialog?: Snippet;
    helpDialog?: Snippet;
    elementLinkDialog?: Snippet;
    imageExportDialog?: Snippet;
    jsonExportDialog?: Snippet;
    pasteChartDialog?: Snippet;
    activeConfirmDialog?: Snippet;

    eyeDropper?: Snippet;

    /** Optional content injected into the Section for the selected-shape
     * actions island. Caller provides the full Island + contents (LayerUI
     * wraps in the outer Section only); the caller picks padding etc. */
    selectedShapeActions?: Snippet;
    /** Full shapes-toolbar interior. Caller provides Stack.Col/Row + Island
     * wrapping; LayerUI only supplies the outer Section + the welcome-screen
     * toolbar-hint tunnel outlet. */
    shapesToolbar?: Snippet;
    userList?: Snippet;
    topRightUI?: Snippet;
    stats?: Snippet;

    sidebars?: Snippet;

    footer?: Snippet;

    mobileMenu?: Snippet;
  } = $props();

  // If no ambient TUNNELS_KEY is provided by a wrapping Sveltedraw root,
  // create one and publish it here so all descendants (MainMenu, Footer,
  // WelcomeScreen, etc.) see the same instance.
  const ambientTunnels = getContext<TunnelsContext | undefined>(TUNNELS_KEY);
  const tunnels: TunnelsContext = ambientTunnels ?? createTunnelsContext();
  if (!ambientTunnels) setContext(TUNNELS_KEY, tunnels);

  const editorInterface =
    getContext<EditorInterface | undefined>(EDITOR_INTERFACE_KEY);

  const isMobile = $derived(editorInterface?.formFactor === "phone");
  const isCompactStylesPanel = $derived(stylesPanelMode === "compact");
  const isElementLinkDialog = $derived(
    appState.openDialog?.name === "elementLinkSelector",
  );

  // Hide the default sidebar trigger when the default sidebar is already
  // open AND docked.
  const showSidebarTrigger = $derived(
    !appState.viewModeEnabled &&
      !isElementLinkDialog &&
      (!isSidebarDocked ||
        appState.openSidebar?.name !== DEFAULT_SIDEBAR.name),
  );
</script>

<!-- ─── Host-supplied children (rendered first so WithInternalFallback lets
     user components win over the default slots below) ──────────────────── -->
{@render children?.()}

<!-- ─── Default fallback renders ──────────────────────────────────────── -->
{@render defaultMainMenu?.()}
{@render defaultSidebarTrigger?.()}
{@render defaultOverwriteConfirmDialog?.()}
{#if appState.openDialog?.name === "ttd"}
  {@render defaultTTDDialog?.()}
{/if}

<!-- ─── Loading + errors ──────────────────────────────────────────────── -->
{#if appState.isLoading}
  <LoadingMessage delay={250} />
{/if}
{#if appState.errorMessage}
  {@render errorDialog?.()}
{/if}

<!-- ─── Overlays + dialogs ────────────────────────────────────────────── -->
{#if !isMobile}
  {@render eyeDropper?.()}
{/if}
{#if appState.openDialog?.name === "help"}
  {@render helpDialog?.()}
{/if}
{@render activeConfirmDialog?.()}
{#if appState.openDialog?.name === "elementLinkSelector"}
  {@render elementLinkDialog?.()}
{/if}

<TunnelOut tunnel={tunnels.OverwriteConfirmDialogTunnel} />
{@render imageExportDialog?.()}
{@render jsonExportDialog?.()}
{#if appState.openDialog?.name === "charts"}
  {@render pasteChartDialog?.()}
{/if}

<!-- ─── Mobile layout (full replacement) ──────────────────────────────── -->
{#if isMobile}
  {@render mobileMenu?.()}
{:else}
  <!-- ─── Desktop layout ──────────────────────────────────────────────── -->
  <div
    class="layer-ui__wrapper"
    style={appState.openSidebar &&
    isSidebarDocked &&
    editorInterface?.canFitSidebar
      ? "width: calc(100% - var(--right-sidebar-width));"
      : undefined}
  >
    {#if renderWelcomeScreen}
      <TunnelOut tunnel={tunnels.WelcomeScreenCenterTunnel} />
    {/if}

    <!-- ─── Top bar ──────────────────────────────────────────────────── -->
    <FixedSideContainer side="top">
      <div class="App-menu App-menu_top">
        <StackCol
          gap={isCompactStylesPanel
            ? LAYER_UI_SPACING_COMPACT.menuTopGap
            : LAYER_UI_SPACING_DEFAULT.menuTopGap}
          class="App-menu_top__left"
        >
          {#snippet children()}
            <!-- canvas actions: MainMenuTunnel outlet + optional welcome
                 hint. Host supplies content via MainMenuTunnel.In original,
                 so no caller customization hook is needed here. -->
            <div style="position: relative;">
              <TunnelOut tunnel={tunnels.MainMenuTunnel} />
              {#if renderWelcomeScreen}
                <TunnelOut tunnel={tunnels.WelcomeScreenMenuHintTunnel} />
              {/if}
            </div>

            <!-- selected-shape actions island (caller conditionally renders
                 based on `showSelectedShapeActions(elements, appState)`). -->
            <div
              class={clsx("selected-shape-actions-container", {
                "selected-shape-actions-container--compact":
                  isCompactStylesPanel,
              })}
            >
              {@render selectedShapeActions?.()}
            </div>
          {/snippet}
        </StackCol>

        <!-- Shapes toolbar (hidden in view mode + element-link dialog) -->
        {#if !appState.viewModeEnabled && !isElementLinkDialog}
          <Section
            heading="shapes"
            class="shapes-section"
          >
            {#snippet headingChildren(header: Snippet)}
              <div style="position: relative;">
                {#if renderWelcomeScreen}
                  <TunnelOut
                    tunnel={tunnels.WelcomeScreenToolbarHintTunnel}
                  />
                {/if}
                {@render header()}
                {@render shapesToolbar?.()}
              </div>
            {/snippet}
          </Section>
        {/if}

        <!-- Top-right: UserList + custom UI + sidebar trigger + stats -->
        <div
          class={clsx(
            "layer-ui__wrapper__top-right zen-mode-transition",
            {
              "transition-right": appState.zenModeEnabled,
              "layer-ui__wrapper__top-right--compact": isCompactStylesPanel,
            },
          )}
        >
          {#if appState.collaborators.size > 0}
            {@render userList?.()}
          {/if}
          {@render topRightUI?.()}
          {#if showSidebarTrigger}
            <TunnelOut tunnel={tunnels.DefaultSidebarTriggerTunnel} />
          {/if}
          {@render stats?.()}
        </div>
      </div>
    </FixedSideContainer>

    <!-- Footer (host-supplied with pre-wired ZoomActions/UndoRedo/Help) -->
    {@render footer?.()}

    <!-- ─── Floating status stack: Toast + scroll-back-to-content ─────── -->
    {#if appState.toast || appState.scrolledOutside}
      <div class="floating-status-stack">
        {#if appState.toast}
          <Toast
            message={appState.toast.message}
            onClose={onToastClose}
            duration={appState.toast.duration}
            closable={appState.toast.closable}
          />
        {:else if appState.scrolledOutside}
          <button
            type="button"
            class="scroll-back-to-content"
            onclick={onScrollBackToContent}
          >
            Scroll back to content
          </button>
        {/if}
      </div>
    {/if}
  </div>

  {@render sidebars?.()}
{/if}
