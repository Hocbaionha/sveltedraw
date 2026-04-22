<script lang="ts">
  // Tunnel "Out" — renders all snippets registered with the given Tunnel,
  // in registration order.

  import type { Tunnel } from "../state/tunnels.svelte.js";

  let { tunnel }: { tunnel: Tunnel } = $props();
</script>

{#each tunnel.entries as entry (entry.id)}
  {@render entry.snippet()}
{/each}
