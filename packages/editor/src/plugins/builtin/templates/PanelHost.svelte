<script lang="ts" module>
  import type { TemplatesState } from "./state.svelte.js";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Template = any;

  type Bindings = {
    state: TemplatesState;
    onSelect: (template: Template) => void;
  };

  let bindings: Bindings | null = null;

  export function bindPanelHost(b: Bindings): void {
    bindings = b;
  }
</script>

<script lang="ts">
  import TemplateSelector from "../../../components/TemplateSelector.svelte";

  const safe = $derived(bindings);
</script>

{#if safe?.state.open}
  <TemplateSelector
    onSelect={(t) => {
      safe.onSelect(t);
      safe.state.open = false;
    }}
    onClose={() => (safe.state.open = false)}
  />
{/if}
