<script lang="ts">
  // Port of packages/excalidraw/components/LockButton.tsx
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
  class={clsx("ToolIcon ToolIcon__lock ToolIcon_size_medium", {
    "is-mobile": isMobile,
  })}
  title={`${title} — Q`}
>
  <input
    class="ToolIcon_type_checkbox"
    type="checkbox"
    {name}
    onchange={onChange}
    {checked}
    aria-label={title}
    data-testid="toolbar-lock"
  />
  <div class="ToolIcon__icon">
    <Icon name={checked ? "LockedIcon" : "UnlockedIcon"} />
  </div>
</label>
