<script lang="ts">
  // Port of packages/excalidraw/components/dropdownMenu/DropdownMenuItemContent.tsx
  // formFactor read from EDITOR_INTERFACE_KEY context (fallback to "desktop").

  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import type { EditorInterface } from "@sveltedraw/common";
  import { EDITOR_INTERFACE_KEY } from "../state/index.js";
  import Ellipsify from "./Ellipsify.svelte";

  let {
    icon,
    shortcut,
    badge,
    textStyle,
    children,
  }: {
    icon?: Snippet;
    shortcut?: string;
    badge?: Snippet;
    textStyle?: string;
    children: Snippet;
  } = $props();

  const editorInterface =
    getContext<EditorInterface | undefined>(EDITOR_INTERFACE_KEY);
  const showShortcut = $derived(
    !!shortcut && editorInterface?.formFactor !== "phone",
  );
</script>

{#if icon}
  <div class="dropdown-menu-item__icon">{@render icon()}</div>
{/if}
<div style={textStyle} class="dropdown-menu-item__text">
  <Ellipsify>
    {@render children()}
  </Ellipsify>
</div>
{#if badge}
  <div class="dropdown-menu-item__badge">{@render badge()}</div>
{/if}
{#if showShortcut}
  <div class="dropdown-menu-item__shortcut">{shortcut}</div>
{/if}
