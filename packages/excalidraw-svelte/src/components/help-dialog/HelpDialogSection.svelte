<script lang="ts">
  // Section heading + islands wrapper inside HelpDialog.
  import type { Snippet } from "svelte";

  let {
    title,
    children,
  }: {
    title: string;
    children: Snippet;
  } = $props();
</script>

<h3>{title}</h3>
<div class="HelpDialog__islands-container">
  {@render children()}
</div>
