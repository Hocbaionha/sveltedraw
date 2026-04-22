<script lang="ts" module>
  // Port of packages/excalidraw/components/PasteChartDialog.tsx
  // SCSS sidecar (PasteChartDialog.scss) loaded globally by host app.
  //
  // Presentational only: the host supplies a `chartPreview` snippet that
  // receives `{ chartType, colorSeed }` and owns SVG preview rendering
  // (`exportToSvg(renderSpreadsheet(...))`), insertion, and any theme
  // wiring. Same for the optional plain-text preview.
  export type ChartType = "bar" | "line" | "radar";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import Dialog from "./Dialog.svelte";
  import Icon from "../icons/Icon.svelte";

  let {
    onClose,
    chartTypes = ["bar", "line", "radar"],
    chartPreview,
    rawText,
    plainTextPreview,
    title = "Paste as chart",
    plainTextLabel = "Plain text",
    chartLabels = { bar: "Bar chart", line: "Line chart", radar: "Radar chart" },
  }: {
    onClose: () => void;
    chartTypes?: readonly ChartType[];
    /** Renders one preview button per chart type. Receives chartType +
     * colorSeed and is responsible for both the SVG render and the insert
     * action on click. Return null to hide that chart. */
    chartPreview: Snippet<[{ chartType: ChartType; colorSeed: number }]>;
    /** Raw spreadsheet text — when present, plainTextPreview is rendered. */
    rawText?: string;
    plainTextPreview?: Snippet<[{ rawText: string }]>;
    title?: string;
    plainTextLabel?: string;
    chartLabels?: Record<ChartType, string>;
  } = $props();

  let colorSeed = $state(Math.random());

  function reshuffle() {
    colorSeed = Math.random();
  }

  function handleReshuffleKey(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      reshuffle();
    }
  }
</script>

{#snippet titleSnippet()}
  <div class="PasteChartDialog__title">
    <div class="PasteChartDialog__titleText">{title}</div>
    <div
      class="PasteChartDialog__reshuffleBtn"
      onclick={reshuffle}
      role="button"
      tabindex="0"
      onkeydown={handleReshuffleKey}
    >
      <Icon name="bucketFillIcon" />
    </div>
  </div>
{/snippet}

<Dialog
  size="regular"
  onCloseRequest={onClose}
  class="PasteChartDialog"
  autofocus={false}
  title={titleSnippet}
>
  <div class="container">
    {#each chartTypes as chartType (chartType)}
      {@render chartPreview({ chartType, colorSeed })}
    {/each}
    {#if rawText && plainTextPreview}
      {@render plainTextPreview({ rawText })}
    {/if}
  </div>
</Dialog>
