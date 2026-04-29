<script lang="ts">
  // Port of packages/excalidraw/components/ShareableLinkDialog.tsx
  // i18n strings as props with English fallback. The original calls
  // copyTextToSystemClipboard from the upstream excalidraw clipboard helper;
  // we reuse it via the @sveltedraw/excalidraw alias so behaviour matches
  // (exec-command fallback, etc.).

  import Dialog from "./Dialog.svelte";
  import FilledButton from "./FilledButton.svelte";
  import TextField from "./TextField.svelte";
  import { createCopyStatus } from "../state/useCopyStatus.svelte.js";
  // @ts-ignore upstream clipboard helper
  import { copyTextToSystemClipboard } from "@sveltedraw/engine/clipboard";

  let {
    link,
    onCloseRequest,
    setErrorMessage,
    title = "Shareable link",
    copyLabel = "Copy link",
    securelyMessage = "🔒 The scene will be uploaded securely and shared with anyone who has the link.",
    copyErrorMessage = "Couldn't copy to clipboard.",
    fieldLabel = "Link",
  }: {
    link: string;
    onCloseRequest: () => void;
    setErrorMessage: (error: string) => void;
    title?: string;
    copyLabel?: string;
    securelyMessage?: string;
    copyErrorMessage?: string;
    fieldLabel?: string;
  } = $props();

  const copyStatus = createCopyStatus();
  let inputRef: HTMLInputElement | undefined = $state();

  async function copyRoomLink() {
    try {
      await copyTextToSystemClipboard(link);
    } catch (e) {
      setErrorMessage(copyErrorMessage);
    }
    inputRef?.select();
  }
</script>

<Dialog {onCloseRequest} title={false} size="small">
  <div class="ShareableLinkDialog">
    <h3>{title}</h3>
    <div class="ShareableLinkDialog__linkRow">
      <TextField
        bind:ref={inputRef}
        label={fieldLabel}
        readonly
        fullWidth
        value={link}
        selectOnRender
      />
      <FilledButton
        size="large"
        label={copyLabel}
        iconName="copyIcon"
        status={copyStatus.status}
        onclick={() => {
          copyStatus.onCopy();
          return copyRoomLink();
        }}
      />
    </div>
    <div class="ShareableLinkDialog__description">
      {securelyMessage}
    </div>
  </div>
</Dialog>
