<script lang="ts">
  import type { TextProperties, TextAlignment, FontWeight, FontStyle, TextDecoration } from '../texteditor/types.js';
  import { getTextProperties } from '../texteditor/types.js';

  interface TextElement {
    id: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
    textColor?: string;
    textAlignment?: string;
    lineHeight?: number;
    angle?: number;
    [key: string]: unknown;
  }

  let { selectedElements, onTextPropertiesChange } = $props();

  const textElement = $derived(selectedElements.length === 1 ? selectedElements[0] : null);
  const propsObj = $derived(textElement ? getTextProperties(textElement) : {} as Partial<TextProperties>);

  const fontFamilies = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'];
  const fontSizes = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
  const alignmentOptions: TextAlignment[] = ['left', 'center', 'right', 'justify'];

  const updateProperty = (property: keyof TextProperties, value: any) => {
    if (!textElement) return;
    onTextPropertiesChange(textElement.id, { [property]: value });
  };

  const toggleBold = () => {
    if (!textElement) return;
    const newWeight = (propsObj.fontWeight === 'bold' ? 'normal' : 'bold') as FontWeight;
    updateProperty('fontWeight', newWeight);
  };

  const toggleItalic = () => {
    if (!textElement) return;
    const newStyle = (propsObj.fontStyle === 'italic' ? 'normal' : 'italic') as FontStyle;
    updateProperty('fontStyle', newStyle);
  };

  const toggleUnderline = () => {
    if (!textElement) return;
    const current = propsObj.textDecoration || 'none';
    const newDecoration = (current === 'underline' ? 'none' : 'underline') as TextDecoration;
    updateProperty('textDecoration', newDecoration);
  };

  const toggleStrikethrough = () => {
    if (!textElement) return;
    const current = propsObj.textDecoration || 'none';
    const newDecoration = (current === 'line-through' ? 'none' : 'line-through') as TextDecoration;
    updateProperty('textDecoration', newDecoration);
  };
</script>

<div class="text-editor-panel">
  <div class="te-header">
    <h3 class="te-title">Text Properties</h3>
    {#if textElement}
      <span class="te-element">Text Element</span>
    {/if}
  </div>

  {#if selectedElements.length === 0}
    <div class="te-message">
      <p>Select a text element to edit properties</p>
    </div>
  {:else if selectedElements.length > 1}
    <div class="te-message">
      <p>Select a single text element to edit properties</p>
    </div>
  {:else if textElement}
    <!-- Font Family -->
    <div class="te-section">
      <label for="font-family" class="te-label">Font:</label>
      <select
        id="font-family"
        class="te-select"
        value={propsObj.fontFamily || 'Arial'}
        onchange={(e) => updateProperty('fontFamily', e.currentTarget.value)}
      >
        {#each fontFamilies as font}
          <option value={font}>{font}</option>
        {/each}
      </select>
    </div>

    <!-- Font Size -->
    <div class="te-section">
      <label for="font-size" class="te-label">Size:</label>
      <select
        id="font-size"
        class="te-select"
        value={propsObj.fontSize || 16}
        onchange={(e) => updateProperty('fontSize', parseInt(e.currentTarget.value))}
      >
        {#each fontSizes as size}
          <option value={size}>{size}px</option>
        {/each}
      </select>
    </div>

    <!-- Text Formatting -->
    <div class="te-section">
      <p class="te-label">Formatting:</p>
      <div class="te-format-buttons">
        <button
          class="te-format-btn"
          class:active={propsObj.fontWeight === 'bold'}
          title="Bold (Ctrl+B)"
          onclick={toggleBold}
        >
          <strong>B</strong>
        </button>
        <button
          class="te-format-btn"
          class:active={propsObj.fontStyle === 'italic'}
          title="Italic (Ctrl+I)"
          onclick={toggleItalic}
        >
          <em>I</em>
        </button>
        <button
          class="te-format-btn"
          class:active={propsObj.textDecoration === 'underline'}
          title="Underline (Ctrl+U)"
          onclick={toggleUnderline}
        >
          <u>U</u>
        </button>
        <button
          class="te-format-btn"
          class:active={propsObj.textDecoration === 'line-through'}
          title="Strikethrough"
          onclick={toggleStrikethrough}
        >
          <s>S</s>
        </button>
      </div>
    </div>

    <!-- Text Alignment -->
    <div class="te-section">
      <p class="te-label">Alignment:</p>
      <div class="te-align-buttons">
        {#each alignmentOptions as align}
          <button
            class="te-align-btn"
            class:active={propsObj.textAlignment === align}
            title={`Align ${align}`}
            onclick={() => updateProperty('textAlignment', align)}
          >
            {align.charAt(0).toUpperCase()}
          </button>
        {/each}
      </div>
    </div>

    <!-- Text Color -->
    <div class="te-section">
      <label for="text-color" class="te-label">Color:</label>
      <input
        id="text-color"
        type="color"
        class="te-color"
        value={propsObj.textColor || '#000000'}
        onchange={(e) => updateProperty('textColor', e.currentTarget.value)}
      />
    </div>

    <!-- Line Height -->
    <div class="te-section">
      <label class="te-label">
        <span>Line Height:</span>
        <input
          type="range"
          min="1"
          max="3"
          step="0.25"
          value={propsObj.lineHeight || 1.5}
          onchange={(e) => updateProperty('lineHeight', parseFloat(e.currentTarget.value))}
        />
        <span class="te-value">{(propsObj.lineHeight || 1.5).toFixed(2)}</span>
      </label>
    </div>

    <!-- Rotation -->
    <div class="te-section">
      <label class="te-label">
        <span>Rotation:</span>
        <input
          type="range"
          min="0"
          max="360"
          step="5"
          value={propsObj.rotation || 0}
          onchange={(e) => updateProperty('rotation', parseInt(e.currentTarget.value))}
        />
        <span class="te-value">{propsObj.rotation || 0}°</span>
      </label>
    </div>
  {/if}
</div>

<style>
  .text-editor-panel {
    padding: 12px;
    border-left: 1px solid #e5e7ea;
    background: white;
    font-size: 13px;
    max-height: 600px;
    overflow-y: auto;
  }

  :global(.excalidraw.theme--dark) .text-editor-panel {
    background: #232329;
    border-left-color: #363636;
    color: #e5e7ea;
  }

  .te-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7ea;
  }

  :global(.excalidraw.theme--dark) .te-header {
    border-bottom-color: #363636;
  }

  .te-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  :global(.excalidraw.theme--dark) .te-title {
    color: #e5e7ea;
  }

  .te-element {
    font-size: 11px;
    padding: 2px 6px;
    background: #6965db;
    color: white;
    border-radius: 3px;
  }

  .te-message {
    padding: 12px;
    background: #f5f5f5;
    border-radius: 4px;
    text-align: center;
  }

  :global(.excalidraw.theme--dark) .te-message {
    background: #2e2e36;
  }

  .te-message p {
    margin: 0;
    font-size: 12px;
    color: #666;
  }

  :global(.excalidraw.theme--dark) .te-message p {
    color: #aaa;
  }

  .te-section {
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #f0f0f0;
  }

  :global(.excalidraw.theme--dark) .te-section {
    border-bottom-color: #2e2e36;
  }

  .te-label {
    display: flex;
    align-items: center;
    margin-bottom: 6px;
    font-size: 12px;
    color: #333;
    font-weight: 600;
    gap: 6px;
  }

  :global(.excalidraw.theme--dark) .te-label {
    color: #e5e7ea;
  }

  .te-label input[type='range'] {
    flex: 1;
    min-width: 80px;
  }

  .te-value {
    min-width: 40px;
    text-align: right;
    color: #6965db;
    font-weight: 600;
  }

  .te-select {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #d1d4da;
    border-radius: 4px;
    background: white;
    color: inherit;
    font-size: 12px;
  }

  :global(.excalidraw.theme--dark) .te-select {
    background: #2e2e36;
    border-color: #363636;
  }

  .te-color {
    width: 60px;
    height: 32px;
    border: 1px solid #d1d4da;
    border-radius: 4px;
    cursor: pointer;
  }

  :global(.excalidraw.theme--dark) .te-color {
    border-color: #363636;
  }

  .te-format-buttons {
    display: flex;
    gap: 4px;
  }

  .te-format-btn {
    flex: 1;
    padding: 6px;
    border: 1px solid #d1d4da;
    border-radius: 4px;
    background: white;
    color: #333;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  :global(.excalidraw.theme--dark) .te-format-btn {
    background: #2e2e36;
    border-color: #363636;
    color: #e5e7ea;
  }

  .te-format-btn:hover {
    background: #f0f0f0;
    border-color: #6965db;
  }

  :global(.excalidraw.theme--dark) .te-format-btn:hover {
    background: #363636;
    border-color: #6965db;
  }

  .te-format-btn.active {
    background: #6965db;
    color: white;
    border-color: #6965db;
  }

  .te-align-buttons {
    display: flex;
    gap: 4px;
  }

  .te-align-btn {
    flex: 1;
    padding: 6px;
    border: 1px solid #d1d4da;
    border-radius: 4px;
    background: white;
    color: #333;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  :global(.excalidraw.theme--dark) .te-align-btn {
    background: #2e2e36;
    border-color: #363636;
    color: #e5e7ea;
  }

  .te-align-btn:hover {
    background: #f0f0f0;
    border-color: #6965db;
  }

  :global(.excalidraw.theme--dark) .te-align-btn:hover {
    background: #363636;
    border-color: #6965db;
  }

  .te-align-btn.active {
    background: #6965db;
    color: white;
    border-color: #6965db;
  }
</style>
