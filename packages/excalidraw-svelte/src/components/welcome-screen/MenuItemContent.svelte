<script lang="ts">
  // Port of internal WelcomeScreenMenuItemContent from welcome-screen/WelcomeScreen.Center.tsx
  // Reads editorInterface.formFactor from EDITOR_INTERFACE_KEY context to hide
  // the shortcut on phones. If no context provided, defaults to showing it.

  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import type { EditorInterface } from "@sveltedraw/common";
  import { EDITOR_INTERFACE_KEY } from "../../state/index.js";

  let {
    icon,
    shortcut,
    children,
  }: {
    icon?: Snippet;
    shortcut?: string | null;
    children: Snippet;
  } = $props();

  const editorInterface =
    getContext<EditorInterface | undefined>(EDITOR_INTERFACE_KEY);
  const showShortcut = $derived(
    !!shortcut && editorInterface?.formFactor !== "phone",
  );
</script>

<div class="welcome-screen-menu-item__icon">{@render icon?.()}</div>
<div class="welcome-screen-menu-item__text">{@render children()}</div>
{#if showShortcut}
  <div class="welcome-screen-menu-item__shortcut">{shortcut}</div>
{/if}
