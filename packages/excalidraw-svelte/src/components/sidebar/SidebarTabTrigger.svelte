<script lang="ts">
  import type { Snippet } from "svelte";
  import { Tabs } from "bits-ui";

  let {
    children,
    tab,
    onSelect,
    ...rest
  }: {
    children: Snippet;
    tab: string;
    onSelect?: (event: Event) => void;
    [key: string]: unknown;
  } = $props();
</script>

<Tabs.Trigger value={tab}>
  {#snippet child({ props })}
    <button
      {...props}
      {...rest}
      type="button"
      class="excalidraw-button sidebar-tab-trigger"
      onclick={(event) => onSelect?.(event)}
    >
      {@render children()}
    </button>
  {/snippet}
</Tabs.Trigger>
