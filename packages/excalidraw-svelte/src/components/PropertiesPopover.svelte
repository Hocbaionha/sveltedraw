<script lang="ts">
  // Port of packages/excalidraw/components/PropertiesPopover.tsx
  // editorInterface via EDITOR_INTERFACE_KEY context (fallback "desktop").
  // `container` is taken as a prop here (Phase 6 will source it from App).

  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import clsx from "clsx";
  import { Popover as BitsPopover } from "bits-ui";
  // @ts-ignore upstream package
  import { isInteractive } from "@excalidraw/common";
  import type { EditorInterface } from "@excalidraw/common";
  import { EDITOR_INTERFACE_KEY } from "../state/index.js";
  import Island from "./Island.svelte";

  let {
    class: className = "",
    container,
    children,
    style,
    onClose,
    onkeydown,
    onpointerleave,
    onFocusOutside,
    onPointerDownOutside,
    preventAutoFocusOnTouch = false,
    ref = $bindable<HTMLDivElement | null>(null),
  }: {
    class?: string;
    container: HTMLElement | null;
    children: Snippet;
    style?: string;
    onClose: () => void;
    onkeydown?: (event: KeyboardEvent) => void;
    onpointerleave?: (event: PointerEvent) => void;
    onFocusOutside?: (event: FocusEvent) => void;
    onPointerDownOutside?: (event: PointerEvent) => void;
    preventAutoFocusOnTouch?: boolean;
    ref?: HTMLDivElement | null;
  } = $props();

  const editorInterface =
    getContext<EditorInterface | undefined>(EDITOR_INTERFACE_KEY);
  const isMobilePortrait = $derived(
    editorInterface?.formFactor === "phone" && !editorInterface?.isLandscape,
  );
</script>

<BitsPopover.Portal to={container ?? undefined}>
  <BitsPopover.Content
    side={isMobilePortrait ? "bottom" : "right"}
    align={isMobilePortrait ? "center" : "start"}
    alignOffset={-16}
    sideOffset={20}
    onOpenAutoFocus={(e) => {
      if (preventAutoFocusOnTouch && editorInterface?.isTouchScreen) {
        e.preventDefault();
      }
    }}
    onCloseAutoFocus={(e) => {
      e.stopPropagation();
      e.preventDefault();
      if (container && !isInteractive(document.activeElement)) {
        container.focus();
      }
      onClose();
    }}
  >
    {#snippet child({ props })}
      <div
        {...props}
        bind:this={ref}
        class={clsx("focus-visible-none", className)}
        data-prevent-outside-click
        style={`z-index: var(--zIndex-ui-styles-popup); ${
          editorInterface?.formFactor === "phone" ? "margin-left: 0.5rem; " : ""
        }${style ?? ""}`}
        {onkeydown}
        {onpointerleave}
      >
        <Island padding={3} {style}>
          {@render children()}
        </Island>
      </div>
    {/snippet}
  </BitsPopover.Content>
</BitsPopover.Portal>
