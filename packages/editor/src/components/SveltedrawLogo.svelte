<script lang="ts" module>
  // SCSS sidecar (SveltedrawLogo.scss) loaded globally by host app.
  // The full SVG paths are long; we re-use the original inline markup
  // verbatim via a module-level constant to keep the component readable.
  export type LogoSize =
    | "xs"
    | "small"
    | "normal"
    | "large"
    | "custom"
    | "mobile";
</script>

<script lang="ts">
  import LogoIconSvg from "./SveltedrawLogo.icon.svelte";
  import LogoTextSvg from "./SveltedrawLogo.text.svelte";

  let {
    size = "small",
    withText = false,
    style,
  }: {
    size?: LogoSize;
    withText?: boolean;
    style?: string;
  } = $props();
</script>

<div class={`SveltedrawLogo is-${size}`} {style}>
  <LogoIconSvg />
  {#if withText}<LogoTextSvg />{/if}
</div>
