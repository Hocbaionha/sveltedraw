<script lang="ts">
  // @ts-ignore
  import { isColorDark } from "@sveltedraw/common";

  let {
    color,
    keyLabel,
    isShade = false,
  }: {
    color: string;
    keyLabel: string | number;
    isShade?: boolean;
  } = $props();
</script>

<div
  class="color-picker__button__hotkey-label"
  style="color: {isColorDark(color) ? '#fff' : '#000'};"
>
  {#if isShade}⇧{/if}{keyLabel}
</div>
