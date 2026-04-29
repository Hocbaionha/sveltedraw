<script lang="ts">
  // Port of packages/excalidraw/components/ElementLinkDialog.tsx
  // SCSS sidecar (ElementLinkDialog.scss) loaded globally by host app.
  //
  // Scene-agnostic: the element mutation is hoisted to an
  // `onConfirm(nextLink: string | null)` callback. The caller also resolves
  // the current `link` from selection and updates it reactively.

  import { getContext } from "svelte";
  // @ts-ignore upstream package
  import { KEYS } from "@sveltedraw/common";
  import DialogActionButton from "./DialogActionButton.svelte";
  import TextField from "./TextField.svelte";
  import ToolButton from "./ToolButton.svelte";
  import Icon from "../icons/Icon.svelte";

  let {
    link,
    originalLink,
    onClose,
    onConfirm,
    title = "Element link",
    description = "Add or edit a link on this element",
    cancelLabel = "Cancel",
    confirmLabel = "Confirm",
    removeLabel = "Remove",
    enabled = true,
  }: {
    /** Current link value (null when empty). */
    link: string | null;
    /** Pre-existing link saved on the element; controls the "Remove" button. */
    originalLink: string | null;
    onClose?: () => void;
    /** Called with the next link (null = clear). */
    onConfirm: (nextLink: string | null) => void;
    title?: string;
    description?: string;
    cancelLabel?: string;
    confirmLabel?: string;
    removeLabel?: string;
    /** When false, ESC/ENTER global handlers are inactive (pass the result
     * of `appState.openDialog?.name === "elementLinkSelector"`). */
    enabled?: boolean;
  } = $props();

  // svelte-ignore state_referenced_locally
  let nextLink = $state(link);
  let linkEdited = $state(false);

  // Sync external link prop into the local editable state on every change.
  $effect(() => {
    nextLink = link;
  });

  function handleConfirm() {
    if (nextLink && nextLink !== originalLink) {
      onConfirm(nextLink);
    } else if (!nextLink && linkEdited) {
      onConfirm(null);
    }
    onClose?.();
  }

  $effect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === KEYS.ENTER) {
        handleConfirm();
      } else if (event.key === KEYS.ESCAPE) {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });
</script>

<div class="ElementLinkDialog">
  <div class="ElementLinkDialog__header">
    <h2>{title}</h2>
    <p>{description}</p>
  </div>

  <div class="ElementLinkDialog__input">
    <TextField
      value={nextLink ?? ""}
      onChange={(value) => {
        if (!linkEdited) linkEdited = true;
        nextLink = value;
      }}
      onKeyDown={(event) => {
        if (event.key === KEYS.ENTER) handleConfirm();
      }}
      class="ElementLinkDialog__input-field"
      selectOnRender
    />

    {#if originalLink && nextLink}
      <ToolButton
        type="button"
        title={removeLabel}
        aria-label={removeLabel}
        label={removeLabel}
        onclick={() => {
          nextLink = null;
          linkEdited = true;
        }}
        class="ElementLinkDialog__remove"
      >
        {#snippet icon()}
          <Icon name="TrashIcon" />
        {/snippet}
      </ToolButton>
    {/if}
  </div>

  <div class="ElementLinkDialog__actions">
    <DialogActionButton
      label={cancelLabel}
      onclick={() => onClose?.()}
      style="margin-right: 10px;"
    />
    <DialogActionButton
      label={confirmLabel}
      onclick={handleConfirm}
      actionType="primary"
    />
  </div>
</div>
