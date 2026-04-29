<script lang="ts">
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
    text = "Help",
  }: {
    children?: Snippet;
    text?: string;
  } = $props();

  const tunnels = getContext<TunnelsContext>(TUNNELS_KEY);
</script>

<TunnelIn tunnel={tunnels.WelcomeScreenHelpHintTunnel}>
  <div
    class="excalifont welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--help"
  >
    <div>{#if children}{@render children()}{:else}{text}{/if}</div>
    <Icon name="WelcomeScreenHelpArrow" />
  </div>
</TunnelIn>
