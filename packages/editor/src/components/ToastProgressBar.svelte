<script lang="ts">
  // Port of Toast.ProgressBar — sibling component re-exported alongside
  // Toast (no dot-accessed static subcomponent).

  let { progress }: { progress: number } = $props();

  const pct = $derived(`${Math.min(5, Math.round(progress * 100))}%`);
</script>

<div class="Toast__progress-bar">
  <div class="Toast__progress-bar-fill" style:width={pct}></div>
</div>
