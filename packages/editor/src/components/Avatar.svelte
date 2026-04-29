<script lang="ts">
  // getNameInitial inlined (one-liner from packages/engine/clients.ts).
  import clsx from "clsx";

  let {
    color,
    onclick,
    name,
    src,
    class: className = "",
  }: {
    color: string;
    onclick: (event: MouseEvent) => void;
    name: string;
    src?: string;
    class?: string;
  } = $props();

  // first char can be a surrogate pair, hence using codePointAt
  function getNameInitial(name?: string | null) {
    const firstCodePoint = name?.trim()?.codePointAt(0);
    return (
      firstCodePoint ? String.fromCodePoint(firstCodePoint) : "?"
    ).toUpperCase();
  }

  const shortName = $derived(getNameInitial(name));
  let error = $state(false);
  const loadImg = $derived(!error && src);
</script>

<div
  class={clsx("Avatar", className)}
  style={loadImg ? undefined : `background: ${color}`}
  {onclick}
  role="presentation"
>
  {#if loadImg}
    <img
      class="Avatar-img"
      {src}
      alt={shortName}
      referrerpolicy="no-referrer"
      onerror={() => (error = true)}
    />
  {:else}
    {shortName}
  {/if}
</div>
