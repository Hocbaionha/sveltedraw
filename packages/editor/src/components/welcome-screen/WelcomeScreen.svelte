<script lang="ts">
  // Port of welcome-screen/WelcomeScreen.tsx — top-level wrapper.
  //
  // When no children are supplied, renders the default Hints. The default
  // <Center /> is omitted until Phase 6 wires up its ActionManager-dependent
  // sub-items (MenuItemHelp, MenuItemLoadScene). Callers that need a center
  // panel today should pass their own <Center> as a child.

  import type { Snippet } from "svelte";
  import MenuHint from "./MenuHint.svelte";
  import ToolbarHint from "./ToolbarHint.svelte";
  import HelpHint from "./HelpHint.svelte";

  let { children }: { children?: Snippet } = $props();
</script>

{#if children}
  {@render children()}
{:else}
  <MenuHint />
  <ToolbarHint />
  <HelpHint />
{/if}
