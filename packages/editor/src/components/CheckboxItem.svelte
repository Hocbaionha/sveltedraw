<script lang="ts">
  import type { Snippet } from "svelte";
  import clsx from "clsx";
  import Icon from "../icons/Icon.svelte";

  let {
    checked,
    onChange,
    class: className = "",
    children,
  }: {
    checked: boolean;
    onChange: (checked: boolean, event: MouseEvent) => void;
    class?: string;
    children?: Snippet;
  } = $props();

  function handleClick(event: MouseEvent) {
    onChange(!checked, event);
    const box = (event.currentTarget as HTMLDivElement).querySelector(
      ".Checkbox-box",
    ) as HTMLButtonElement | null;
    box?.focus();
  }
</script>

<div
  class={clsx("Checkbox", className, { "is-checked": checked })}
  onclick={handleClick}
  role="presentation"
>
  <button
    type="button"
    class="Checkbox-box"
    role="checkbox"
    aria-checked={checked}
  >
    <Icon name="checkIcon" />
  </button>
  <div class="Checkbox-label">
    {@render children?.()}
  </div>
</div>
