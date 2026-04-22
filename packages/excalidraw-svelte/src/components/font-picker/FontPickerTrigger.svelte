<script lang="ts">
  // Port of packages/excalidraw/components/FontPicker/FontPickerTrigger.tsx
  //
  // Exposes `onToggle`; the caller owns the open-popup appState update.

  import { Popover as BitsPopover } from "bits-ui";
  import ButtonIcon from "../ButtonIcon.svelte";
  import Icon from "../../icons/Icon.svelte";

  let {
    isOpened = false,
    compactMode = false,
    onToggle,
    title = "Show fonts",
  }: {
    isOpened?: boolean;
    compactMode?: boolean;
    onToggle: () => void;
    title?: string;
  } = $props();

  const compactStyle = $derived(
    compactMode
      ? "width: 2rem; height: 2rem; background-color: var(--mobile-action-button-bg);"
      : "",
  );
</script>

<BitsPopover.Trigger>
  {#snippet child({ props })}
    <div {...props} data-openpopup="fontFamily" class="properties-trigger">
      {#snippet textIcon()}
        <Icon name="TextIcon" />
      {/snippet}
      <ButtonIcon
        standalone
        icon={textIcon}
        {title}
        class="properties-trigger"
        testId="font-family-show-fonts"
        active={isOpened}
        onclick={onToggle}
        style={`border: none; ${compactStyle}`}
      />
    </div>
  {/snippet}
</BitsPopover.Trigger>
