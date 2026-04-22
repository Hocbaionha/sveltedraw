<script lang="ts">
  // Port of packages/excalidraw/components/welcome-screen/WelcomeScreen.Hints.tsx (MenuHint)
  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import {
    TUNNELS_KEY,
    type TunnelsContext,
  } from "../../state/tunnels.svelte.js";
  import TunnelIn from "../TunnelIn.svelte";
  import Icon from "../../icons/Icon.svelte";

  // Pass `children` to override the default label, OR `text` to substitute the
  // i18n string. Defaults to the upstream English fallback.
  let {
    children,
    text = "Menu",
  }: {
    children?: Snippet;
    text?: string;
  } = $props();

  const tunnels = getContext<TunnelsContext>(TUNNELS_KEY);
</script>

<TunnelIn tunnel={tunnels.WelcomeScreenMenuHintTunnel}>
  <div
    class="excalifont welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--menu"
  >
    <Icon name="WelcomeScreenMenuArrow" />
    <div class="welcome-screen-decor-hint__label">
      {#if children}{@render children()}{:else}{text}{/if}
    </div>
  </div>
</TunnelIn>
