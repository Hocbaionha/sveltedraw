<script lang="ts" module>
  // SCSS sidecar (ImageExportDialog.scss + ExportDialog.scss) loaded globally.
  //
  // Presentational only. The caller is responsible for:
  //   - snapshotting elements/appState at open time (so toggles don't re-export)
  //   - rendering the preview into the `previewEl` bind this component
  //     exposes (typically via an effect running `exportToCanvas` whenever
  //     the displayed values change), or supplying a `renderPreview` snippet
  //   - persisting setting changes via the on*Change callbacks (~5 original
  //     action-manager actions)
  //   - performing the actual PNG/SVG/clipboard export inside on*Click callbacks
  //     (the 3 `onExportImage(type, …)` triggers)

  export type ExportScale = number;

  export type ImageExportDialogProps = {
    open: boolean;
    onCloseRequest: () => void;

    // ─── Settings (controlled) ──────────────────────────────────────────
    /** Name shown in the filename input (when nativeFileSystemSupported is false). */
    projectName: string;
    onProjectNameChange?: (value: string) => void;
    /** True when the canvas has a selection — toggles the "only selected" switch. */
    hasSelection?: boolean;
    exportSelectionOnly: boolean;
    onExportSelectionOnlyChange?: (value: boolean) => void;
    exportWithBackground: boolean;
    onExportWithBackgroundChange?: (value: boolean) => void;
    exportWithDarkMode: boolean;
    onExportWithDarkModeChange?: (value: boolean) => void;
    embedScene: boolean;
    onEmbedSceneChange?: (value: boolean) => void;
    exportScale: ExportScale;
    onExportScaleChange?: (value: ExportScale) => void;
    /** Available scales (default mirrors the original EXPORT_SCALES). */
    scales?: readonly ExportScale[];

    // ─── Environment ────────────────────────────────────────────────────
    nativeFileSystemSupported?: boolean;
    /** When true, the "Copy PNG to clipboard" button is shown. */
    supportsClipboardBlob?: boolean;

    // ─── Actions ────────────────────────────────────────────────────────
    onExportPng?: () => void;
    onExportSvg?: () => void;
    onCopyPngToClipboard?: () => void | Promise<void>;
    /** Status from a CopyStatus store — drives the "Copied!" feedback on the
     * clipboard button. */
    copyStatus?: "success" | null;

    // ─── Preview ────────────────────────────────────────────────────────
    /** Set to true to show the ErrorCanvasPreview overlay. */
    previewError?: boolean;
    /** When provided, renders inside the preview canvas slot instead of the
     * ref-only div. Useful when the caller wants to provide their own
     * preview element/structure. */
    renderPreview?: import("svelte").Snippet<
      [{ previewEl: HTMLDivElement | undefined }]
    >;

    // ─── i18n strings ───────────────────────────────────────────────────
    title?: string;
    onlySelectedLabel?: string;
    backgroundLabel?: string;
    darkModeLabel?: string;
    embedSceneLabel?: string;
    embedSceneTooltip?: string;
    scaleLabel?: string;
    pngTitle?: string;
    pngButton?: string;
    svgTitle?: string;
    svgButton?: string;
    copyTitle?: string;
    copyButton?: string;
  };
</script>

<script lang="ts">
  import Dialog from "../Dialog.svelte";
  import Switch from "../Switch.svelte";
  import RadioGroup from "../RadioGroup.svelte";
  import FilledButton from "../FilledButton.svelte";
  import ExportSetting from "./ExportSetting.svelte";
  import ErrorCanvasPreview from "./ErrorCanvasPreview.svelte";

  const DEFAULT_SCALES: readonly ExportScale[] = [1, 2, 3];

  let {
    open,
    onCloseRequest,
    projectName,
    onProjectNameChange,
    hasSelection = false,
    exportSelectionOnly,
    onExportSelectionOnlyChange,
    exportWithBackground,
    onExportWithBackgroundChange,
    exportWithDarkMode,
    onExportWithDarkModeChange,
    embedScene,
    onEmbedSceneChange,
    exportScale,
    onExportScaleChange,
    scales = DEFAULT_SCALES,
    nativeFileSystemSupported = false,
    supportsClipboardBlob = false,
    onExportPng,
    onExportSvg,
    onCopyPngToClipboard,
    copyStatus = null,
    previewError = false,
    renderPreview,
    title = "Export image",
    onlySelectedLabel = "Only selected",
    backgroundLabel = "With background",
    darkModeLabel = "Dark mode",
    embedSceneLabel = "Embed scene",
    embedSceneTooltip = "Embeds the scene data so the file can be re-imported.",
    scaleLabel = "Scale",
    pngTitle = "Export to PNG",
    pngButton = "PNG",
    svgTitle = "Export to SVG",
    svgButton = "SVG",
    copyTitle = "Copy PNG to clipboard",
    copyButton = "Copy to clipboard",
  }: ImageExportDialogProps = $props();

  let previewEl: HTMLDivElement | undefined = $state();

  const scaleChoices = $derived(
    scales.map((s) => ({ value: s, label: `${s}×` })),
  );
</script>

{#if open}
  <Dialog {onCloseRequest} size="wide" title={false}>
    <div class="ImageExportModal">
      <h3>{title}</h3>
      <div class="ImageExportModal__preview">
        {#if renderPreview}
          {@render renderPreview({ previewEl })}
        {:else}
          <div class="ImageExportModal__preview__canvas" bind:this={previewEl}>
            {#if previewError}
              <ErrorCanvasPreview />
            {/if}
          </div>
        {/if}
        <div class="ImageExportModal__preview__filename">
          {#if !nativeFileSystemSupported}
            <input
              type="text"
              class="TextInput"
              value={projectName}
              style="width: 30ch;"
              oninput={(event) =>
                onProjectNameChange?.(
                  (event.target as HTMLInputElement).value,
                )}
            />
          {/if}
        </div>
      </div>
      <div class="ImageExportModal__settings">
        <h3>{title}</h3>
        {#if hasSelection}
          <ExportSetting
            label={onlySelectedLabel}
            name="exportOnlySelected"
          >
            <Switch
              name="exportOnlySelected"
              checked={exportSelectionOnly}
              onChange={(checked) => onExportSelectionOnlyChange?.(checked)}
            />
          </ExportSetting>
        {/if}
        <ExportSetting
          label={backgroundLabel}
          name="exportBackgroundSwitch"
        >
          <Switch
            name="exportBackgroundSwitch"
            checked={exportWithBackground}
            onChange={(checked) => onExportWithBackgroundChange?.(checked)}
          />
        </ExportSetting>
        <ExportSetting label={darkModeLabel} name="exportDarkModeSwitch">
          <Switch
            name="exportDarkModeSwitch"
            checked={exportWithDarkMode}
            onChange={(checked) => onExportWithDarkModeChange?.(checked)}
          />
        </ExportSetting>
        <ExportSetting
          label={embedSceneLabel}
          tooltip={embedSceneTooltip}
          name="exportEmbedSwitch"
        >
          <Switch
            name="exportEmbedSwitch"
            checked={embedScene}
            onChange={(checked) => onEmbedSceneChange?.(checked)}
          />
        </ExportSetting>
        <ExportSetting label={scaleLabel} name="exportScale">
          <RadioGroup
            name="exportScale"
            value={exportScale}
            onChange={(scale) => onExportScaleChange?.(scale)}
            choices={scaleChoices}
          />
        </ExportSetting>

        <div class="ImageExportModal__settings__buttons">
          <FilledButton
            class="ImageExportModal__settings__buttons__button"
            label={pngTitle}
            onclick={() => onExportPng?.()}
            iconName="downloadIcon"
          >
            {pngButton}
          </FilledButton>
          <FilledButton
            class="ImageExportModal__settings__buttons__button"
            label={svgTitle}
            onclick={() => onExportSvg?.()}
            iconName="downloadIcon"
          >
            {svgButton}
          </FilledButton>
          {#if supportsClipboardBlob && onCopyPngToClipboard}
            <FilledButton
              class="ImageExportModal__settings__buttons__button"
              label={copyTitle}
              status={copyStatus}
              onclick={() => onCopyPngToClipboard()}
              iconName="copyIcon"
            >
              {copyButton}
            </FilledButton>
          {/if}
        </div>
      </div>
    </div>
  </Dialog>
{/if}
