<script lang="ts">
  // Port of Center from welcome-screen/WelcomeScreen.Center.tsx
  //
  // The original renders a default <Logo />, <Heading>, and <Menu> with
  // <MenuItemHelp /> + <MenuItemLoadScene /> when no children are supplied.
  // Those defaults depend on SveltedrawLogo, ActionManager and i18n which
  // are not yet ported — so for now Center requires `children`. The default
  // content will land alongside Phase 6 (App-context bridge).

  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import {
    TUNNELS_KEY,
    type TunnelsContext,
  } from "../../state/tunnels.svelte.js";
  import TunnelIn from "../TunnelIn.svelte";

  let { children }: { children?: Snippet } = $props();

  const tunnels = getContext<TunnelsContext>(TUNNELS_KEY);
</script>

<TunnelIn tunnel={tunnels.WelcomeScreenCenterTunnel}>
  <div class="welcome-screen-center">
    {@render children?.()}
  </div>
</TunnelIn>
