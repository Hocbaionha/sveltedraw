<script lang="ts">
  // Port of packages/excalidraw/components/footer/Footer.tsx (shell only).
  //
  // Layout slots exposed as snippet props: ZoomActions, UndoRedoActions,
  // HelpButton, ExitZenModeButton (all action-manager-backed upstream); the
  // tunnel outlets (FooterCenterTunnel.Out, WelcomeScreenHelpHintTunnel.Out)
  // are rendered directly. The caller supplies each snippet.

  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import clsx from "clsx";
  import StackCol from "./StackCol.svelte";
  import Section from "./Section.svelte";
  import TunnelOut from "./TunnelOut.svelte";
  import HelpButton from "./HelpButton.svelte";
  import {
    TUNNELS_KEY,
    type TunnelsContext,
  } from "../state/tunnels.svelte.js";

  let {
    zenModeEnabled = false,
    viewModeEnabled = false,
    renderWelcomeScreen = false,
    zoomActions,
    undoRedoActions,
    exitZenModeButton,
    onHelpClick,
  }: {
    zenModeEnabled?: boolean;
    viewModeEnabled?: boolean;
    renderWelcomeScreen?: boolean;
    /** ZoomActions renderer — Phase 6 wires `actionManager.renderAction` +
     * `zoom` from appState. */
    zoomActions?: Snippet;
    /** UndoRedoActions renderer — Phase 6 wires `actionManager.renderAction`. */
    undoRedoActions?: Snippet;
    /** ExitZenModeButton — Phase 6 wires `actionManager` + `showExitZenModeBtn`. */
    exitZenModeButton?: Snippet;
    /** Help button click handler (Phase 6 dispatches `actionShortcuts`). */
    onHelpClick: () => void;
  } = $props();

  const tunnels = getContext<TunnelsContext>(TUNNELS_KEY);
</script>

<!-- svelte-ignore a11y_no_redundant_roles -->
<footer
  role="contentinfo"
  class="layer-ui__wrapper__footer App-menu App-menu_bottom"
>
  <div
    class={clsx("layer-ui__wrapper__footer-left zen-mode-transition", {
      "layer-ui__wrapper__footer-left--transition-left": zenModeEnabled,
    })}
  >
    <StackCol gap={2}>
      <Section heading="canvasActions">
        {#if zoomActions}
          {@render zoomActions()}
        {/if}

        {#if !viewModeEnabled && undoRedoActions}
          {@render undoRedoActions()}
        {/if}
      </Section>
    </StackCol>
  </div>
  <TunnelOut tunnel={tunnels.FooterCenterTunnel} />
  <div
    class={clsx("layer-ui__wrapper__footer-right zen-mode-transition", {
      "transition-right": zenModeEnabled,
    })}
  >
    <div style="position: relative;">
      {#if renderWelcomeScreen}
        <TunnelOut tunnel={tunnels.WelcomeScreenHelpHintTunnel} />
      {/if}
      <HelpButton onclick={onHelpClick} />
    </div>
  </div>
  {#if exitZenModeButton}
    {@render exitZenModeButton()}
  {/if}
</footer>
