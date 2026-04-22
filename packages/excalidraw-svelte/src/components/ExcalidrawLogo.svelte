<script lang="ts" module>
  // Port of packages/excalidraw/components/ExcalidrawLogo.tsx
  // SCSS sidecar (ExcalidrawLogo.scss) loaded globally by host app.
  // The full SVG paths are long; we re-use the upstream inline markup
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
  import LogoIconSvg from "./ExcalidrawLogo.icon.svelte";
  import LogoTextSvg from "./ExcalidrawLogo.text.svelte";

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

<div class={`ExcalidrawLogo is-${size}`} {style}>
  <LogoIconSvg />
  {#if withText}<LogoTextSvg />{/if}
</div>
