<script lang="ts">
  import type { Snippet } from "svelte";
  import { Tabs } from "bits-ui";

  let { children }: { children: Snippet } = $props();
</script>

<Tabs.List class="sidebar-triggers">
  {@render children()}
</Tabs.List>
