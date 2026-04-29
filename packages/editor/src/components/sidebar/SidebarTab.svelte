<script lang="ts">
  import type { Snippet } from "svelte";
  import { Tabs } from "bits-ui";

  let {
    tab,
    children,
  }: {
    tab: string;
    children: Snippet;
  } = $props();
</script>

<Tabs.Content value={tab} data-testid={tab}>
  {@render children()}
</Tabs.Content>
