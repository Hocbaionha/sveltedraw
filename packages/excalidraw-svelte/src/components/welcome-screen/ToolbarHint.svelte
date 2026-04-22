<script lang="ts">
  // Port of packages/excalidraw/components/welcome-screen/WelcomeScreen.Hints.tsx (ToolbarHint)
  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import {
    TUNNELS_KEY,
    type TunnelsContext,
  } from "../../state/tunnels.svelte.js";
  import TunnelIn from "../TunnelIn.svelte";
  import Icon from "../../icons/Icon.svelte";

  let {
    children,
    text = "Pick a tool & start drawing!",
  }: {
    children?: Snippet;
    text?: string;
  } = $props();

  const tunnels = getContext<TunnelsContext>(TUNNELS_KEY);
</script>

<TunnelIn tunnel={tunnels.WelcomeScreenToolbarHintTunnel}>
  <div
    class="excalifont welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--toolbar"
  >
    <div class="welcome-screen-decor-hint__label">
      {#if children}{@render children()}{:else}{text}{/if}
    </div>
    <Icon name="WelcomeScreenTopToolbarArrow" />
  </div>
</TunnelIn>
