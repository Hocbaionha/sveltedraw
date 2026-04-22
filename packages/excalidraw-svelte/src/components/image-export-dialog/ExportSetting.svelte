<script lang="ts">
  // Single label + control row inside the ImageExportDialog settings panel.
  import type { Snippet } from "svelte";
  import Tooltip from "../Tooltip.svelte";
  import Icon from "../../icons/Icon.svelte";

  let {
    label,
    tooltip,
    name,
    children,
  }: {
    label: string;
    tooltip?: string;
    name?: string;
    children: Snippet;
  } = $props();
</script>

<div class="ImageExportModal__settings__setting" title={label}>
  <label
    for={name}
    class="ImageExportModal__settings__setting__label"
  >
    {label}
    {#if tooltip}
      <Tooltip label={tooltip} long={true}>
        {#snippet children()}
          <Icon name="helpIcon" />
        {/snippet}
      </Tooltip>
    {/if}
  </label>
  <div class="ImageExportModal__settings__setting__content">
    {@render children()}
  </div>
</div>
