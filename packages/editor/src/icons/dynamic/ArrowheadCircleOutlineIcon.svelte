<script lang="ts">
  interface Props { flip?: boolean; }
  let { flip = false }: Props = $props();
  const transform = $derived(flip ? "translate(40, 0) scale(-1, 1)" : "");
</script>

<svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 40 20">
  <g stroke="currentColor" fill="none" {transform} stroke-width="2">
    <path d="M7,11 H25" stroke-linecap="round" />
    <circle cx="29" cy="11" r="4" />
  </g>
</svg>
