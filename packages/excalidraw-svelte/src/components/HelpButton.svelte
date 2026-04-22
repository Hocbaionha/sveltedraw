<script lang="ts">
  // Port of packages/excalidraw/components/HelpButton.tsx
  // i18n strings as props with English fallback (i18n wiring lives in Phase 6+).
  import Icon from "../icons/Icon.svelte";

  let {
    onclick,
    title = "Help — ?",
    ariaLabel = "Help",
  }: {
    onclick?: () => void;
    title?: string;
    ariaLabel?: string;
  } = $props();
</script>

<button
  class="help-icon"
  {onclick}
  type="button"
  {title}
  aria-label={ariaLabel}
>
  <Icon name="HelpIcon" />
</button>
