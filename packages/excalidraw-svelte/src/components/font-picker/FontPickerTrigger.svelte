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
    <!-- BitsPopover.Trigger already handles the open-toggle via the
         spread `props` (click handler on this wrapper). ButtonIcon
         previously ALSO wired onclick={onToggle} which caused a
         double-toggle — click → button sets open=true → click bubbles
         → bits-ui sees open=true and closes it. Net no-op. Fix: swallow
         the inner button's click at capture so only bits-ui toggles. -->
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
        onclick={(e: MouseEvent) => {
          // Let the click bubble to the BitsPopover.Trigger wrapper;
          // don't call onToggle directly or we get a double-toggle.
          void e;
        }}
        style={`border: none; ${compactStyle}`}
      />
    </div>
  {/snippet}
</BitsPopover.Trigger>
