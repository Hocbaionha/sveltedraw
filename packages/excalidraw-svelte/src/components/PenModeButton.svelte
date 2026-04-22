<script lang="ts">
  // Port of packages/excalidraw/components/PenModeButton.tsx
  // SCSS sidecar (ToolIcon.scss) loaded globally by host app.
  import clsx from "clsx";
  import Icon from "../icons/Icon.svelte";

  let {
    title,
    name,
    checked,
    onChange,
    zenModeEnabled = false,
    isMobile = false,
    penDetected,
  }: {
    title?: string;
    name?: string;
    checked: boolean;
    onChange?: () => void;
    zenModeEnabled?: boolean;
    isMobile?: boolean;
    penDetected: boolean;
  } = $props();
</script>

{#if penDetected}
  <label
    class={clsx("ToolIcon ToolIcon__penMode ToolIcon_size_medium", {
      "is-mobile": isMobile,
    })}
    title={title}
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
      <Icon name="PenModeIcon" />
    </div>
  </label>
{/if}
