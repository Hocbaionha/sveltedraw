<script lang="ts" module>
  // SCSS sidecar (Dialog.scss) loaded globally by host app.
  //
  // Contract:
  //  - excalId via EXCAL_ID_KEY context
  //  - editorInterface via EDITOR_INTERFACE_KEY context
  //  - Optional `onBeforeClose` callback runs before the dialog tears down
  //    (use for app-state side effects like closing menus).
  //  - i18n close button text taken as `closeLabel` prop (English fallback).
  export type DialogSize = number | "small" | "regular" | "wide" | undefined;

  function getDialogSize(size: DialogSize): number {
    if (size && typeof size === "number") return size;
    switch (size) {
      case "small":
        return 550;
      case "wide":
        return 1024;
      case "regular":
      default:
        return 800;
    }
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import clsx from "clsx";
  // @ts-ignore
  import { KEYS, queryFocusableElements } from "@sveltedraw/common";
  import type { EditorInterface } from "@sveltedraw/common";
  import { EDITOR_INTERFACE_KEY, EXCAL_ID_KEY } from "../state/index.js";
  import Modal from "./Modal.svelte";
  import Island from "./Island.svelte";
  import Icon from "../icons/Icon.svelte";

  let {
    children,
    class: className = "",
    size,
    onCloseRequest,
    onBeforeClose,
    title,
    autofocus = true,
    closeOnClickOutside = true,
    closeLabel = "Close",
  }: {
    children: Snippet;
    class?: string;
    size?: DialogSize;
    onCloseRequest: () => void;
    /** Optional Phase 6 side-effect (setAppState({openMenu: null}) etc.). */
    onBeforeClose?: () => void;
    title: Snippet | string | false;
    autofocus?: boolean;
    closeOnClickOutside?: boolean;
    closeLabel?: string;
  } = $props();

  const excalId = getContext<string | undefined>(EXCAL_ID_KEY) ?? "";
  const editorInterface =
    getContext<EditorInterface | undefined>(EDITOR_INTERFACE_KEY);
  const isFullscreen = $derived(editorInterface?.formFactor === "phone");

  let islandNode: HTMLDivElement | undefined = $state();
  const lastActiveElement =
    typeof document !== "undefined" ? document.activeElement : null;

  // Auto-focus + Tab focus trap inside the dialog.
  $effect(() => {
    if (!islandNode) return;
    const node = islandNode;
    const focusableElements = queryFocusableElements(node);

    setTimeout(() => {
      if (focusableElements.length > 0 && autofocus) {
        // Skip the close button if it's first; focus the first content control.
        (focusableElements[1] ?? focusableElements[0]).focus();
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== KEYS.TAB) return;
      const elements = queryFocusableElements(node);
      const { activeElement } = document;
      const currentIndex = elements.findIndex(
        (el: HTMLElement) => el === activeElement,
      );
      if (currentIndex === 0 && event.shiftKey) {
        elements[elements.length - 1].focus();
        event.preventDefault();
      } else if (currentIndex === elements.length - 1 && !event.shiftKey) {
        elements[0].focus();
        event.preventDefault();
      }
    };

    node.addEventListener("keydown", handleKeyDown);
    return () => node.removeEventListener("keydown", handleKeyDown);
  });

  function handleClose() {
    onBeforeClose?.();
    if (lastActiveElement instanceof HTMLElement) {
      lastActiveElement.focus();
    }
    onCloseRequest();
  }

  const titleId = $derived(`${excalId}-dialog-title`);
</script>

<Modal
  className={clsx("Dialog", className, { "Dialog--fullscreen": isFullscreen })}
  labelledBy={titleId}
  maxWidth={getDialogSize(size)}
  onCloseRequest={handleClose}
  {closeOnClickOutside}
>
  <Island bind:ref={islandNode}>
    {#if title}
      <h2 id={titleId} class="Dialog__title">
        <span class="Dialog__titleContent">
          {#if typeof title === "string"}{title}{:else}{@render title()}{/if}
        </span>
      </h2>
    {/if}
    {#if isFullscreen}
      <button
        class="Dialog__close"
        onclick={handleClose}
        title={closeLabel}
        aria-label={closeLabel}
        type="button"
      >
        <Icon name="CloseIcon" />
      </button>
    {/if}
    <div class="Dialog__content">
      {@render children()}
    </div>
  </Island>
</Modal>
