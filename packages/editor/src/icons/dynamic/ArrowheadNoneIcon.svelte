<script lang="ts">
  interface Props { flip?: boolean; }
  let { flip = false }: Props = $props();
  const transform = $derived(flip ? "translate(40, 0) scale(-1, 1)" : "");
</script>

<svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 40 20">
  <g
    {transform}
    stroke="currentColor"
    opacity="0.3"
    stroke-width="2"
    fill="none"
    stroke-linecap="round"
  >
    <path d="M7,11 H19" />
    <path d="M25,6 L33,16 M33,6 L25,16" />
  </g>
</svg>
