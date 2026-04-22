<script lang="ts">
  // Port of packages/excalidraw/components/HandButton.tsx
  import clsx from "clsx";
  // @ts-ignore upstream package
  import { KEYS } from "@excalidraw/common";
  import ToolButton from "./ToolButton.svelte";
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

<ToolButton
  class={clsx("Shape", { fillable: false, active: checked })}
  type="radio"
  {checked}
  name="editor-current-shape"
  title={`${title} — H`}
  keyBindingLabel={!isMobile ? KEYS.H.toLocaleUpperCase() : undefined}
  aria-label={`${title} — H`}
  aria-keyshortcuts={KEYS.H}
  data-testid="toolbar-hand"
  onchange={() => onChange?.()}
>
  {#snippet icon()}
    <Icon name="handIcon" />
  {/snippet}
</ToolButton>
