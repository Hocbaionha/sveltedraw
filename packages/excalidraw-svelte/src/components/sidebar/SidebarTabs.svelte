<script lang="ts">
  // Port of packages/excalidraw/components/Sidebar/SidebarTabs.tsx
  // Uses bits-ui Tabs; `value`/`onValueChange` are controlled by the caller.

  import type { Snippet } from "svelte";
  import { setContext } from "svelte";
  import { Tabs } from "bits-ui";
  import {
    SIDEBAR_TABS_KEY,
    type SidebarTabsContextValue,
  } from "./common.js";

  let {
    children,
    tab,
    onTabChange,
  }: {
    children: Snippet;
    /** Current tab value (controlled). */
    tab: string | undefined;
    onTabChange: (tab: string) => void;
  } = $props();

  // Publish the current tab + setter for SidebarTab/SidebarTabTrigger.
  // svelte-ignore state_referenced_locally state_referenced_locally
  const ctx: SidebarTabsContextValue = $state({ tab, setTab: onTabChange });
  $effect(() => {
    ctx.tab = tab;
    ctx.setTab = onTabChange;
  });
  setContext(SIDEBAR_TABS_KEY, ctx);
</script>

<Tabs.Root
  class="sidebar-tabs-root"
  value={tab ?? ""}
  onValueChange={(v) => onTabChange(v)}
>
  {@render children()}
</Tabs.Root>
