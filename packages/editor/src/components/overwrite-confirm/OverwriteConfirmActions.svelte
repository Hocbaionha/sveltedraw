<script lang="ts">
  // Port of OverwriteConfirm.Actions wrapper.
  import type { Snippet } from "svelte";
  let { children }: { children: Snippet } = $props();
</script>

<div class="OverwriteConfirm__Actions">
  {@render children()}
</div>
