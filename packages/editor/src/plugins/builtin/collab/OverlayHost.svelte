<script lang="ts" module>
  // CollabCursors lives on a canvas overlay. It needs a reactive slice
  // of appState to do scene→viewport conversion (zoom + offset + scroll).
  // The plugin's install captures the appState proxy via api.getAppState
  // and binds it here; the $derived re-derives only when those tracked
  // fields change.

  type AppStateLike = {
    width: number;
    height: number;
    zoom: { value: number };
    offsetLeft: number;
    offsetTop: number;
    scrollX: number;
    scrollY: number;
  };

  type Bindings = {
    appState: AppStateLike;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindOverlayHost(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import CollabCursors from "../../../components/CollabCursors.svelte";

  const safe = $derived(bindings.value);

  const cursorsAppState = $derived.by(() => {
    if (!safe) return null;
    return {
      zoom: safe.appState.zoom,
      offsetLeft: safe.appState.offsetLeft,
      offsetTop: safe.appState.offsetTop,
      scrollX: safe.appState.scrollX,
      scrollY: safe.appState.scrollY,
    };
  });
</script>

{#if cursorsAppState}
  <CollabCursors appState={cursorsAppState} />
{/if}
