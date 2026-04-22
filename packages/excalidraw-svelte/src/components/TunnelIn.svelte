<script lang="ts">
  // Tunnel "In" — registers its `children` snippet with a Tunnel and renders
  // nothing in place. The matching <TunnelOut tunnel={...} /> elsewhere in
  // the tree renders the registered snippets.

  import type { Snippet } from "svelte";
  import type { Tunnel } from "../state/tunnels.svelte.js";

  let {
    tunnel,
    children,
  }: {
    tunnel: Tunnel;
    children: Snippet;
  } = $props();

  $effect(() => {
    const id = tunnel.push(children);
    return () => tunnel.remove(id);
  });
</script>
