<script lang="ts" module>
  // SCSS sidecar (ExportDialog.scss) loaded globally by host app.
  //
  // The original dispatches `actionSaveFileToDisk` through ActionManager and
  // tracks via analytics. Both are Phase 6 territory — exposed here as
  // optional `onSaveToDisk` / `onExportToBackend` callbacks. Custom UI from
  // `exportOpts.renderCustomUI` becomes a `customUi` snippet prop.

  import type { Snippet } from "svelte";

  export type JSONExportDialogProps = {
    /** Controls visibility (mirrors `appState.openDialog?.name === "jsonExport"`). */
    open: boolean;
    onCloseRequest: () => void;
    /** "Save to disk" handler; when omitted, the disk card is hidden. */
    onSaveToDisk?: () => void;
    /** "Export to backend / shareable link" handler; omit to hide card. */
    onExportToBackend?: () => void | Promise<void>;
    /** Optional snippet for `exportOpts.renderCustomUI`. */
    customUi?: Snippet;
    /** Optional snippet for the project-name editor (rendered under disk_details). */
    projectName?: Snippet;
    /** Whether native FS API is available (controls projectName editor render). */
    nativeFileSystemSupported?: boolean;
    /** Localized strings — pass through; English fallbacks otherwise. */
    title?: string;
    diskTitle?: string;
    diskDetails?: string;
    diskButton?: string;
    linkTitle?: string;
    linkDetails?: string;
    linkButton?: string;
  };
</script>

<script lang="ts">
  import Dialog from "./Dialog.svelte";
  import Card from "./Card.svelte";
  import ToolButton from "./ToolButton.svelte";
  import Icon from "../icons/Icon.svelte";

  let {
    open,
    onCloseRequest,
    onSaveToDisk,
    onExportToBackend,
    customUi,
    projectName,
    nativeFileSystemSupported = false,
    title = "Export",
    diskTitle = "Save to disk",
    diskDetails = "Export the scene data as a file",
    diskButton = "Save",
    linkTitle = "Shareable link",
    linkDetails = "Export as a read-only link",
    linkButton = "Export to link",
  }: JSONExportDialogProps = $props();
</script>

{#if open}
  <Dialog {onCloseRequest} {title}>
    <div class="ExportDialog ExportDialog--json">
      <div class="ExportDialog-cards">
        {#if onSaveToDisk}
          <Card color="lime">
            <div class="Card-icon"><Icon name="exportToFileIcon" /></div>
            <h2>{diskTitle}</h2>
            <div class="Card-details">
              {diskDetails}
              {#if !nativeFileSystemSupported && projectName}
                {@render projectName()}
              {/if}
            </div>
            <ToolButton
              class="Card-button"
              type="button"
              title={diskButton}
              aria-label={diskButton}
              showAriaLabel={true}
              onclick={onSaveToDisk}
            />
          </Card>
        {/if}
        {#if onExportToBackend}
          <Card color="pink">
            <div class="Card-icon"><Icon name="LinkIcon" /></div>
            <h2>{linkTitle}</h2>
            <div class="Card-details">{linkDetails}</div>
            <ToolButton
              class="Card-button"
              type="button"
              title={linkButton}
              aria-label={linkButton}
              showAriaLabel={true}
              onclick={async () => {
                try {
                  await onExportToBackend();
                  onCloseRequest();
                } catch (error) {
                  // Surface to caller via console; Phase 6 wraps with
                  // setAppState({ errorMessage }) when integrated.
                  console.error(error);
                }
              }}
            />
          </Card>
        {/if}
        {#if customUi}{@render customUi()}{/if}
      </div>
    </div>
  </Dialog>
{/if}
