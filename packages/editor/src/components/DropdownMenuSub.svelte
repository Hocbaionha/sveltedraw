<script lang="ts">
  // The original parses children to find SubTrigger/SubContent. In Svelte we
  // pass them through as a snippet — consumer composes <DropdownMenuSubTrigger>
  // and <DropdownMenuSubContent> inside the children snippet.

  import type { Snippet } from "svelte";
  import { DropdownMenu as BitsDropdownMenu } from "bits-ui";

  let { children }: { children?: Snippet } = $props();
</script>

<BitsDropdownMenu.Sub>
  {@render children?.()}
</BitsDropdownMenu.Sub>
