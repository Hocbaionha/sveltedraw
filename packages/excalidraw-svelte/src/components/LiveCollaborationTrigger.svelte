<script lang="ts">
  // Port of packages/excalidraw/components/live-collaboration/LiveCollaborationTrigger.tsx
  // SCSS sidecar (LiveCollaborationTrigger.scss) loaded globally by host app.
  //
  // appState width + collaborators count taken as props (Phase 6 wires the
  // appState binding); editorInterface from EDITOR_INTERFACE_KEY context.

  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import clsx from "clsx";
  import {
    type EditorInterface,
    MQ_MIN_WIDTH_DESKTOP,
  } from "@excalidraw/common";
  import { EDITOR_INTERFACE_KEY } from "../state/index.js";
  import Button from "./Button.svelte";
  import Icon from "../icons/Icon.svelte";

  let {
    isCollaborating,
    onSelect,
    width,
    collaboratorCount,
    title = "Live collaboration",
    shareLabel = "Share",
    class: className = "",
  }: {
    isCollaborating: boolean;
    onSelect: () => void;
    /** appState.width — used to decide icon-only vs label rendering. */
    width: number;
    /** appState.collaborators.size */
    collaboratorCount: number;
    title?: string;
    shareLabel?: string;
    class?: string;
  } = $props();

  const editorInterface =
    getContext<EditorInterface | undefined>(EDITOR_INTERFACE_KEY);

  const showIconOnly = $derived(
    editorInterface?.formFactor !== "desktop" || width < MQ_MIN_WIDTH_DESKTOP,
  );
</script>

<Button
  class={clsx("collab-button", className, { active: isCollaborating })}
  type="button"
  {onSelect}
  {title}
  style={`position: relative;${showIconOnly ? "" : " width: auto;"}`}
>
  {#if showIconOnly}
    <Icon name="share" />
  {:else}
    {shareLabel}
  {/if}
  {#if collaboratorCount > 0}
    <div class="CollabButton-collaborators">{collaboratorCount}</div>
  {/if}
</Button>
