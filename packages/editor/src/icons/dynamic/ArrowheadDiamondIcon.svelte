<script lang="ts">
  interface Props { flip?: boolean; }
  let { flip = false }: Props = $props();
  const transform = $derived(flip ? "translate(40, 0) scale(-1, 1)" : "");
</script>

<svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 40 20">
  <g
    stroke="currentColor"
    fill="currentColor"
    {transform}
    stroke-linejoin="round"
  >
    <path d="M7,11 H21" stroke-width="2" stroke-linecap="round" />
    <path d="M21,11 L28,5 L35,11 L28,17 Z" />
  </g>
</svg>
