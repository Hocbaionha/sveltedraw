<script lang="ts">
  interface Props { flip?: boolean; }
  let { flip = false }: Props = $props();
  const transform = $derived(flip ? "translate(40, 0) scale(-1, 1)" : "");
</script>

<svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 40 20">
  <g
    {transform}
    stroke="currentColor"
    stroke-width="2"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M7,11 H33 M23,5 L33,11 L23,17" />
  </g>
</svg>
