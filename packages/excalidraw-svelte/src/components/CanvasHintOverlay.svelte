<script lang="ts">
  // Contextual on-canvas hint overlays:
  //  - Welcome screen (centered, shown when scene is empty and selection
  //    tool is active)
  //  - Tool hint strip (bottom-center, shown when any non-selection tool
  //    is active)
  //
  // The two are mutually exclusive by predicate, so living in one file
  // keeps all hint-style CSS in one place.
  type Props = {
    isEmptyScene: boolean;
    activeToolType: string | null | undefined;
    onOpenHelp: () => void;
  };

  let { isEmptyScene, activeToolType, onOpenHelp }: Props = $props();

  let showWelcome = $derived(isEmptyScene && activeToolType === "selection");
  let showToolHint = $derived(!!activeToolType && activeToolType !== "selection");
</script>

{#if showWelcome}
  <div class="sveltedraw-welcome">
    <div class="sw-title">Sveltedraw</div>
    <div class="sw-hint">
      Pick a tool above or press <kbd>R</kbd> <kbd>D</kbd> <kbd>O</kbd> <kbd>L</kbd> <kbd>A</kbd> <kbd>P</kbd> <kbd>T</kbd> to start drawing.
    </div>
    <div class="sw-hint-alt">
      <kbd>?</kbd> for keyboard shortcuts ·
      <button type="button" class="sw-link" onclick={onOpenHelp}>Open help</button>
    </div>
  </div>
{/if}

{#if showToolHint}
  <div class="sveltedraw-hint">
    {#if activeToolType === "text"}
      Click to place text, then type. <kbd>Esc</kbd> or click elsewhere to commit.
    {:else if activeToolType === "line" || activeToolType === "arrow"}
      Drag for a straight line, or click successive points + press <kbd>Enter</kbd> for a polyline.
    {:else if activeToolType === "freedraw"}
      Draw freehand. Pressure-sensitive if your device supports it.
    {:else}
      Click and drag to draw a {activeToolType}. <kbd>Esc</kbd> to cancel.
    {/if}
  </div>
{/if}

<style>
  .sveltedraw-welcome {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    pointer-events: none;
    z-index: 5;
  }
  .sw-title {
    font-size: 32px;
    font-weight: 700;
    color: #c5c7cc;
    margin-bottom: 12px;
    font-family: Excalifont, Xiaolai, sans-serif;
  }
  :global(.excalidraw.theme--dark) .sw-title {
    color: #4a4a52;
  }
  .sw-hint {
    color: #6b7280;
    font-size: 14px;
    margin-bottom: 8px;
  }
  .sw-hint-alt {
    color: #9ca3af;
    font-size: 12px;
    pointer-events: auto;
  }
  .sw-link {
    background: transparent;
    border: none;
    color: #6965db;
    cursor: pointer;
    text-decoration: underline;
    font-size: 12px;
    padding: 0;
  }

  .sveltedraw-hint {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    padding: 6px 14px;
    background: rgba(30, 30, 30, 0.85);
    color: #fff;
    border-radius: 16px;
    font-size: 12px;
    pointer-events: none;
    z-index: 30;
  }
</style>
