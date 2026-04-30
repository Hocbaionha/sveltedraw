<script lang="ts" module>
  // Module-level binding so the plugin's state + bridge reach the
  // parameterless Component the registry mounts. Same pattern as the
  // other plugin PanelHosts.

  import type { ExportPanelState } from "./state.svelte.js";
  import type { ExportBridge } from "./bridge.js";

  type Bindings = {
    state: ExportPanelState;
    bridge: ExportBridge | null;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindPanelHost(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import ExportPanel from "../../../components/ExportPanel.svelte";

  const safe = $derived(bindings.value);
</script>

{#if safe?.state.active}
  <ExportPanel
    options={safe.state.options}
    presets={safe.state.presets}
    elementCount={safe.bridge?.elementCount ?? 0}
    onExport={(opts) => {
      safe.bridge?.doExport(opts, () => {
        safe.state.active = false;
      });
    }}
    onOptionsChange={(opts) => (safe.state.options = opts)}
    onPresetSelect={(preset) => {
      safe.state.options = {
        ...safe.state.options,
        format: preset.format,
        width: preset.width,
        height: preset.height,
        scale: preset.scale,
        quality: preset.quality,
      };
    }}
    onClose={() => (safe.state.active = false)}
  />
{/if}
