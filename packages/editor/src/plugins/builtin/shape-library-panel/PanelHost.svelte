<script lang="ts" module>
  import type { ShapeLibraryPanelState } from "./state.svelte.js";
  import type { ShapeLibraryBridge } from "./bridge.js";

  type Bindings = {
    state: ShapeLibraryPanelState;
    bridge: ShapeLibraryBridge | null;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindPanelHost(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import ShapeLibraryPanel from "../../../components/ShapeLibraryPanel.svelte";
  import type { LibraryComponent, LibraryCategory } from "../../../library/types.js";
  import SidePanelChrome from "../SidePanelChrome.svelte";

  const safe = $derived(bindings.value);
</script>

<SidePanelChrome
  open={!!(safe?.state.open && safe.bridge)}
  id="builtin/shape-library-panel"
>
  {#if safe?.bridge}
    <ShapeLibraryPanel
      components={safe.bridge.components as LibraryComponent[]}
      categories={safe.bridge.categories as LibraryCategory[]}
      selectedCategoryId={safe.bridge.selectedCategoryId}
      searchQuery={safe.bridge.searchQuery}
      onSelectComponent={(c) => safe.bridge?.onSelectComponent(c)}
      onDeleteComponent={(id) => safe.bridge?.onDeleteComponent(id)}
      onCategoryChange={(id) => safe.bridge?.setSelectedCategory(id)}
      onSearchChange={(q) => safe.bridge?.setSearchQuery(q)}
      onExportLibrary={() => safe.bridge?.onExport()}
      onImportLibrary={() => safe.bridge?.onImport()}
    />
  {/if}
</SidePanelChrome>
