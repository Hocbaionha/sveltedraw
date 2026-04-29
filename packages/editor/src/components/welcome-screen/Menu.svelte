<script lang="ts">
  // Port of internal Menu from welcome-screen/WelcomeScreen.Center.tsx
  import type { Snippet } from "svelte";

  let { children }: { children?: Snippet } = $props();
</script>

<div class="welcome-screen-menu">
  {@render children?.()}
</div>
