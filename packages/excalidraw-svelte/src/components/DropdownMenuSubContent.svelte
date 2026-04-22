<script lang="ts">
  // Port of packages/excalidraw/components/dropdownMenu/DropdownMenuSubContent.tsx
  // formFactor via EDITOR_INTERFACE_KEY context (fallback to "desktop").
  // Applies a viewport-overflow nudge when the element mounts.

  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import clsx from "clsx";
  import { DropdownMenu as BitsDropdownMenu } from "bits-ui";
  import type { EditorInterface } from "@excalidraw/common";
  import { EDITOR_INTERFACE_KEY } from "../state/index.js";
  import Island from "./Island.svelte";
  import StackCol from "./StackCol.svelte";

  const BASE_ALIGN_OFFSET = -4;
  const BASE_SIDE_OFFSET = 4;

  let {
    children,
    class: className = "",
  }: {
    children?: Snippet;
    class?: string;
  } = $props();

  const editorInterface =
    getContext<EditorInterface | undefined>(EDITOR_INTERFACE_KEY);
  const isMobile = $derived(editorInterface?.formFactor === "phone");

  const classNames = $derived(
    clsx(`dropdown-menu dropdown-submenu ${className}`, {
      "dropdown-menu--mobile": isMobile,
    }).trim(),
  );

  let sideOffset = $state(BASE_SIDE_OFFSET);
  let alignOffset = $state(BASE_ALIGN_OFFSET);

  function nudgeForViewport(node: HTMLDivElement | null) {
    if (!node) return;
    const parentContainer = node.closest(".dropdown-menu-container");
    const parentRect = parentContainer?.getBoundingClientRect();
    if (!parentRect) return;
    const menuWidth = node.getBoundingClientRect().width;
    const viewportWidth = window.innerWidth;
    const spaceRemaining = viewportWidth - parentRect.right;
    if (spaceRemaining < menuWidth + 20) {
      sideOffset = spaceRemaining - menuWidth + BASE_ALIGN_OFFSET;
      alignOffset = BASE_ALIGN_OFFSET + 8;
    }
  }
</script>

<BitsDropdownMenu.SubContent {sideOffset} {alignOffset} collisionPadding={8}>
  {#snippet child({ props })}
    <div {...props} class={classNames} use:nudgeForViewport>
      {#if isMobile}
        <StackCol class="dropdown-menu-container">
          {@render children?.()}
        </StackCol>
      {:else}
        <Island class="dropdown-menu-container" padding={2}>
          {@render children?.()}
        </Island>
      {/if}
    </div>
  {/snippet}
</BitsDropdownMenu.SubContent>
