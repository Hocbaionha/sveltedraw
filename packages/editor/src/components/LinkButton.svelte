<script lang="ts">
  import type { Snippet } from "svelte";
  import FilledButton from "./FilledButton.svelte";

  let {
    href,
    children,
  }: {
    href: string;
    children: Snippet;
  } = $props();
</script>

<a {href} target="_blank" rel="noopener" class="link-button">
  <FilledButton>
    {@render children()}
  </FilledButton>
</a>
