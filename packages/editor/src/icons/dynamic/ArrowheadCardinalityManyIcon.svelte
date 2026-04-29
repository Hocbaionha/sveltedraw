<script lang="ts">
  interface Props { flip?: boolean; }
  let { flip = false }: Props = $props();
  const transform = $derived(flip ? "" : "translate(40, 0) scale(-1, 1)");
</script>

<svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 40 20">
  <g
    stroke="currentColor"
    fill="none"
    {transform}
    stroke-linejoin="round"
    stroke-width="2"
  >
    <path d="M35,11 H7 M15,11 L7,5 M15,11 L7,17" />
  </g>
</svg>
