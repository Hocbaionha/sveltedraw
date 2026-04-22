<script lang="ts">
  // Port of packages/excalidraw/components/OverwriteConfirm/OverwriteConfirm.tsx
  // SCSS sidecar (OverwriteConfirm.scss) loaded globally by host app.
  //
  // Uses the singleton `overwriteConfirmStore` (Svelte equivalent of the
  // upstream jotai atom) and registers via OverwriteConfirmDialogTunnel from
  // the per-instance TunnelsContext. WithInternalFallback ensures the user's
  // override (if any) takes precedence over the default.

  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import {
    TUNNELS_KEY,
    type TunnelsContext,
  } from "../../state/tunnels.svelte.js";
  import { overwriteConfirmStore } from "../../state/overwriteConfirmState.svelte.js";
  import Dialog from "../Dialog.svelte";
  import FilledButton from "../FilledButton.svelte";
  import TunnelIn from "../TunnelIn.svelte";
  import WithInternalFallback from "../WithInternalFallback.svelte";
  import OverwriteConfirmActions from "./OverwriteConfirmActions.svelte";
  import Icon from "../../icons/Icon.svelte";

  let {
    children,
    fallback = false,
  }: {
    children: Snippet;
    /** Pass `true` when this is the built-in default render (excalidraw's own
     * OverwriteConfirmDialog inside LayerUI), so the user's override wins. */
    fallback?: boolean;
  } = $props();

  const tunnels = getContext<TunnelsContext>(TUNNELS_KEY);
  const state = $derived(overwriteConfirmStore.state);

  function handleClose() {
    if (state.active) state.onClose();
    overwriteConfirmStore.reset();
  }

  function handleConfirm() {
    if (state.active) state.onConfirm();
    overwriteConfirmStore.reset();
  }
</script>

<WithInternalFallback name="OverwriteConfirmDialog" {fallback}>
  {#if state.active}
    <TunnelIn tunnel={tunnels.OverwriteConfirmDialogTunnel}>
      <Dialog onCloseRequest={handleClose} title={false} size={916}>
        <div class="OverwriteConfirm">
          <h3>{state.title}</h3>
          <div
            class="OverwriteConfirm__Description OverwriteConfirm__Description--color-{state.color}"
          >
            <div class="OverwriteConfirm__Description__icon">
              <Icon name="alertTriangleIcon" />
            </div>
            <div>
              {#if typeof state.description === "string"}
                {state.description}
              {:else}
                {@render state.description()}
              {/if}
            </div>
            <div class="OverwriteConfirm__Description__spacer"></div>
            <FilledButton
              color={state.color}
              size="large"
              label={state.actionLabel}
              onclick={handleConfirm}
            />
          </div>
          <OverwriteConfirmActions>
            {@render children()}
          </OverwriteConfirmActions>
        </div>
      </Dialog>
    </TunnelIn>
  {/if}
</WithInternalFallback>
