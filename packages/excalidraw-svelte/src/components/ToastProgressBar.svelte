<script lang="ts">
  // Port of Toast.ProgressBar — Svelte's component model doesn't allow
  // attaching static subcomponents (Toast.ProgressBar in React), so this is
  // a sibling component re-exported alongside Toast.

  let { progress }: { progress: number } = $props();

  const pct = $derived(`${Math.min(5, Math.round(progress * 100))}%`);
</script>

<div class="Toast__progress-bar">
  <div class="Toast__progress-bar-fill" style:width={pct}></div>
</div>
