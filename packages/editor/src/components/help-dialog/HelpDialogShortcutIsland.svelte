<script lang="ts">
  // A single boxed group of shortcuts (e.g. "Tools", "View", "Editor").
  import type { Snippet } from "svelte";

  let {
    caption,
    children,
    class: className = "",
  }: {
    caption: string;
    children: Snippet;
    class?: string;
  } = $props();
</script>

<div class={`HelpDialog__island ${className}`}>
  <h4 class="HelpDialog__island-title">{caption}</h4>
  <div class="HelpDialog__island-content">
    {@render children()}
  </div>
</div>
