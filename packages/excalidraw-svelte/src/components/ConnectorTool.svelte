<script lang="ts">
  import type { Connector, RoutingStyle } from '../connectors/types.js';
  import { generateConnectorPath } from '../connectors/types.js';

  interface Props {
    connectors: Connector[];
    activeRoutingStyle: RoutingStyle;
    onRoutingStyleChange: (style: RoutingStyle) => void;
  }

  let { connectors, activeRoutingStyle, onRoutingStyleChange }: Props = $props();

  const routingStyles: RoutingStyle[] = ['straight', 'orthogonal', 'curved', 'bezier'];
</script>

<div class="connector-tool">
  <div class="ct-header">
    <label for="routing-select" class="ct-label">Connector Style:</label>
    <select
      id="routing-select"
      class="ct-select"
      bind:value={activeRoutingStyle}
      onchange={(e) => onRoutingStyleChange(activeRoutingStyle)}
    >
      <option value="straight">Straight</option>
      <option value="orthogonal">Orthogonal (Grid)</option>
      <option value="curved">Curved</option>
      <option value="bezier">Bezier</option>
    </select>
  </div>

  <div class="ct-info">
    <p class="ct-text">
      Click two shapes to connect them with a line. Drag existing connectors to reconfigure.
    </p>
  </div>

  {#if connectors.length > 0}
    <div class="ct-list">
      <p class="ct-count">Active Connectors: {connectors.length}</p>
      {#each connectors.slice(0, 5) as connector (connector.id)}
        <div class="ct-item">
          <span class="ct-item-label">{connector.label || 'Untitled'}</span>
          <span class="ct-item-style">{connector.routingStyle}</span>
        </div>
      {/each}
      {#if connectors.length > 5}
        <p class="ct-more">+ {connectors.length - 5} more</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .connector-tool {
    padding: 12px;
    border-left: 1px solid #e5e7ea;
    background: white;
    font-size: 13px;
  }

  :global(.excalidraw.theme--dark) .connector-tool {
    background: #232329;
    border-left-color: #363636;
    color: #e5e7ea;
  }

  .ct-header {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
  }

  .ct-label {
    font-weight: 600;
    white-space: nowrap;
  }

  .ct-select {
    flex: 1;
    padding: 6px 8px;
    border: 1px solid #d1d4da;
    border-radius: 4px;
    background: white;
    color: inherit;
    font-size: 12px;
  }

  :global(.excalidraw.theme--dark) .ct-select {
    background: #2e2e36;
    border-color: #363636;
  }

  .ct-info {
    margin-bottom: 12px;
    padding: 8px;
    background: #f5f5f5;
    border-radius: 4px;
  }

  :global(.excalidraw.theme--dark) .ct-info {
    background: #2e2e36;
  }

  .ct-text {
    margin: 0;
    font-size: 12px;
    color: #666;
    line-height: 1.4;
  }

  :global(.excalidraw.theme--dark) .ct-text {
    color: #aaa;
  }

  .ct-list {
    padding: 8px 0;
    border-top: 1px solid #e5e7ea;
  }

  :global(.excalidraw.theme--dark) .ct-list {
    border-top-color: #363636;
  }

  .ct-count {
    margin: 0 0 8px;
    font-weight: 600;
    color: #6965db;
  }

  .ct-item {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 0;
    font-size: 12px;
    border-bottom: 1px solid #f0f0f0;
  }

  :global(.excalidraw.theme--dark) .ct-item {
    border-bottom-color: #2e2e36;
  }

  .ct-item-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ct-item-style {
    color: #999;
    font-size: 11px;
    padding: 2px 4px;
    background: #f0f0f0;
    border-radius: 2px;
    white-space: nowrap;
  }

  :global(.excalidraw.theme--dark) .ct-item-style {
    background: #2e2e36;
    color: #666;
  }

  .ct-more {
    margin: 4px 0 0;
    font-size: 11px;
    color: #999;
  }
</style>
