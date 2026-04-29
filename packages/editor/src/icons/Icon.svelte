<script lang="ts">
  import { icons } from "./icons";

  interface Props {
    name: string;
  }

  let { name }: Props = $props();
  const def = $derived(icons[name]);
</script>

{#if def}
  {@html def.svg}
{:else}
  <!-- unknown icon: {name} -->
{/if}
