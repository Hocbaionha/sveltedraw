<script lang="ts" module>
  // Module-level binding so the plugin's state + dispatcher reach the
  // parameterless Component the registry mounts.

  import type { CommandPaletteState } from "./state.svelte.js";
  import type { ActionManager } from "../../../actions/manager.svelte.js";

  type Bindings = {
    state: CommandPaletteState;
    actionManager: ActionManager;
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let bindings = $state<{ value: Bindings | null }>({ value: null });

  export function bindPanelHost(b: Bindings): void {
    bindings.value = b;
  }
</script>

<script lang="ts">
  import CommandPalette, {
    type CommandPaletteItem,
  } from "../../../components/command-palette/CommandPalette.svelte";

  const safe = $derived(bindings.value);

  // Build the palette items from the ActionManager's registered set.
  // Predicate-failed actions are excluded so the palette only shows
  // currently-invocable commands. Search filter is a simple
  // case-insensitive substring on label + id; cheap and good enough
  // for a 60-action set.
  const items = $derived.by((): CommandPaletteItem[] => {
    if (!safe?.state.open) return [];
    const am = safe.actionManager;
    const q = safe.state.searchTerm.trim().toLowerCase();
    const out: CommandPaletteItem[] = [];
    for (const action of am.list()) {
      if (!am.isEnabled(action.id)) continue;
      if (q.length > 0) {
        const hay = (action.label + " " + action.id).toLowerCase();
        if (!hay.includes(q)) continue;
      }
      out.push({
        id: action.id,
        label: action.label,
        category: action.category ?? "other",
        shortcut: formatHotkey(action.hotkey),
      });
    }
    return out;
  });

  // Convert the registered hotkey (single string or array) to a
  // human-readable shortcut. Picks the first form for display.
  function formatHotkey(
    hotkey: string | readonly string[] | undefined,
  ): string | null {
    if (!hotkey) return null;
    const first = Array.isArray(hotkey) ? hotkey[0] : hotkey;
    return first ?? null;
  }
</script>

{#if safe?.state.open}
  <CommandPalette
    open
    bind:searchTerm={safe.state.searchTerm}
    {items}
    onClose={() => {
      safe.state.open = false;
      safe.state.searchTerm = "";
    }}
    onSelect={(item) => {
      safe.actionManager.execute(item.id);
      safe.state.open = false;
      safe.state.searchTerm = "";
    }}
  />
{/if}
