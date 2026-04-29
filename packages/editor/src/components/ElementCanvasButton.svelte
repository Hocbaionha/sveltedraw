<script lang="ts">
  import type { Snippet } from "svelte";
  import clsx from "clsx";

  let {
    title,
    icon,
    name,
    checked,
    onChange,
    isMobile = false,
  }: {
    title?: string;
    icon: Snippet;
    name?: string;
    checked: boolean;
    onChange?: () => void;
    isMobile?: boolean;
  } = $props();
</script>

<label
  class={clsx("ToolIcon ToolIcon__MagicButton ToolIcon_size_small", {
    "is-mobile": isMobile,
  })}
  {title}
>
  <input
    class="ToolIcon_type_checkbox"
    type="checkbox"
    {name}
    onchange={onChange}
    {checked}
    aria-label={title}
  />
  <div class="ToolIcon__icon">
    {@render icon()}
  </div>
</label>
