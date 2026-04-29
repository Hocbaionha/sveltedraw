<script lang="ts">
  // composeEventHandlers inlined: call original handler, then ours unless defaultPrevented

  import type { Snippet } from 'svelte';
  import clsx from 'clsx';

  let {
    type = 'button',
    onSelect,
    selected,
    children,
    class: className = '',
    onclick,
    ...rest
  }: {
    type?: 'button' | 'submit' | 'reset';
    onSelect: () => void;
    selected?: boolean;
    children?: Snippet;
    class?: string;
    onclick?: (event: MouseEvent) => void;
    [key: string]: unknown;
  } = $props();

  function handleClick(event: MouseEvent) {
    onclick?.(event);
    if (!event.defaultPrevented) {
      onSelect();
    }
  }
</script>

<button
  {type}
  class={clsx('sveltedraw-button', className, { selected })}
  onclick={handleClick}
  {...rest}
>
  {@render children?.()}
</button>
