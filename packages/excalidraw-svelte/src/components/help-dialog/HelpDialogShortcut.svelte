<script lang="ts">
  // One row inside an island: label on the left + key combos on the right.
  // Each "Cmd+K" splits into <ShortcutKey>Cmd</ShortcutKey>+<ShortcutKey>K
  // </ShortcutKey>; alternatives are separated by "or" (or chain without
  // a separator when `isOr` is false).

  import HelpDialogShortcutKey from "./HelpDialogShortcutKey.svelte";

  let {
    label,
    shortcuts,
    isOr = true,
    orLabel = "or",
  }: {
    label: string;
    /** Each entry is a single combo like "Ctrl+K" or "++". */
    shortcuts: string[];
    /** When false, alternatives chain without an "or" separator. */
    isOr?: boolean;
    orLabel?: string;
  } = $props();

  function upperCaseSingleChars(str: string): string {
    return str.replace(/\b[a-z]\b/, (c) => c.toUpperCase());
  }

  // A trailing "++" means the literal "+" key.
  function splitKeys(shortcut: string): string[] {
    return shortcut.endsWith("++")
      ? [...shortcut.slice(0, -2).split("+"), "+"]
      : shortcut.split("+");
  }
</script>

<div class="HelpDialog__shortcut">
  <div>{label}</div>
  <div class="HelpDialog__key-container">
    {#each shortcuts as shortcut, i (i)}
      {#if i > 0 && isOr}<span>{orLabel}</span>{/if}
      {#each splitKeys(shortcut) as key (key)}
        <HelpDialogShortcutKey label={upperCaseSingleChars(key)} />
      {/each}
    {/each}
  </div>
</div>
