<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import clsx from "clsx";

  let {
    options,
    value,
    onChange,
    group,
  }: {
    options: { value: T; text: string; icon: Snippet }[];
    value: T | null;
    onChange: (value: T) => void;
    group: string;
  } = $props();

  const current = $derived(options.find((op) => op.value === value));

  function cycle() {
    if (!current) return;
    const index = options.indexOf(current);
    const next = (index + 1) % options.length;
    onChange(options[next].value);
  }
</script>

{#if current}
  <label class={clsx({ active: current.value !== null })}>
    <input type="button" name={group} onclick={cycle} />
    {@render current.icon()}
  </label>
{/if}
