<script lang="ts">
  import clsx from "clsx";
  import Icon from "../icons/Icon.svelte";

  let {
    title,
    name,
    checked,
    onChange,
    isMobile = false,
  }: {
    title?: string;
    name?: string;
    checked: boolean;
    onChange?: () => void;
    isMobile?: boolean;
  } = $props();
</script>

<label
  class={clsx("ToolIcon ToolIcon__LaserPointer ToolIcon_size_small", {
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
    data-testid="toolbar-LaserPointer"
  />
  <div class="ToolIcon__icon">
    <Icon name="laserPointerToolIcon" />
  </div>
</label>
