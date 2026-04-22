<script lang="ts">
  // Port of packages/excalidraw/components/footer/FooterCenter.tsx
  // SCSS sidecar (FooterCenter.scss) loaded globally by host app.
  //
  // The original reads zenModeEnabled from useUIAppState(); here it's a prop
  // so the host LayerUI can pass it from its own state binding (Phase 6).

  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import clsx from "clsx";
  import {
    TUNNELS_KEY,
    type TunnelsContext,
  } from "../state/tunnels.svelte.js";
  import TunnelIn from "./TunnelIn.svelte";

  let {
    zenModeEnabled = false,
    children,
  }: {
    zenModeEnabled?: boolean;
    children?: Snippet;
  } = $props();

  const tunnels = getContext<TunnelsContext>(TUNNELS_KEY);
</script>

<TunnelIn tunnel={tunnels.FooterCenterTunnel}>
  <div
    class={clsx("footer-center zen-mode-transition", {
      "layer-ui__wrapper__footer-left--transition-bottom": zenModeEnabled,
    })}
  >
    {@render children?.()}
  </div>
</TunnelIn>
